import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { STAFF_ROLES } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { publishPracticeEvent } from "@/lib/events";
import { audit } from "@/lib/audit";
import {
  ACTION_TO,
  canPerformAction,
  canTransition,
  isAppointmentAction,
  type AppointmentStatus,
} from "@/lib/clinic";

export const dynamic = "force-dynamic";

const CLINICAL_ROLES = ["NURSE", "DOCTOR", "MANAGER"];

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(STAFF_ROLES);
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  // Clinical data (case, vitals, medical history) is restricted to
  // nurse/doctor/manager; reception sees demographics + appointment only.
  const clinical = CLINICAL_ROLES.includes(guard.session.role);

  const appointment = await prisma.appointment.findFirst({
    where: { id, practiceId: guard.staff.practiceId },
    include: {
      patient: clinical
        ? true
        : {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              medicalAidName: true,
              medicalAidNumber: true,
            },
          },
      doctor: { select: { id: true, title: true, firstName: true, lastName: true } },
      case: clinical
        ? {
            include: {
              vitals: { orderBy: { recordedAt: "desc" } },
              diagnoses: { orderBy: { createdAt: "desc" } },
              prescriptions: { orderBy: { createdAt: "desc" } },
              sickNotes: { orderBy: { createdAt: "desc" } },
              attachments: {
                select: {
                  id: true,
                  filename: true,
                  mimeType: true,
                  sizeBytes: true,
                  createdAt: true,
                },
              },
            },
          }
        : false,
      vitals: clinical ? { orderBy: { recordedAt: "desc" } } : false,
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  // Clinical viewers also get the patient's vitals history for trend charts.
  const patientVitals = clinical
    ? await prisma.vitalsRecord.findMany({
        where: { patientId: appointment.patientId },
        orderBy: { recordedAt: "asc" },
        take: 100,
      })
    : [];

  // Clinical chart access is always recorded.
  if (clinical) {
    await audit({
      action: "chart.view",
      actorId: guard.session.sub,
      actorRole: guard.session.role,
      resourceType: "appointment",
      resourceId: appointment.id,
      patientId: appointment.patientId,
      practiceId: guard.staff.practiceId,
      request: _request,
    });
  }

  return NextResponse.json({ appointment, clinical, patientVitals });
}

// Status transitions via named actions (confirm, check_in, start_consult,
// complete, cancel, no_show). Role rights and valid source statuses are
// enforced by the shared rules in lib/clinic.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(STAFF_ROLES);
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!isAppointmentAction(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (!canPerformAction(guard.session.role, action)) {
    return NextResponse.json(
      { error: `Your role may not ${action.replace("_", " ")}` },
      { status: 403 },
    );
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, practiceId: guard.staff.practiceId },
    include: {
      patient: { select: { phone: true, user: { select: { id: true, email: true } } } },
      practice: { select: { practiceName: true, publicId: true } },
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (!canTransition(appointment.status as AppointmentStatus, action)) {
    return NextResponse.json(
      { error: `Cannot ${action.replace("_", " ")} from ${appointment.status}` },
      { status: 409 },
    );
  }

  const now = new Date();
  const practiceName = appointment.practice.practiceName ?? "your practice";
  const patientUser = appointment.patient.user;

  if (action === "check_in") {
    // Assign the next queue number for this practice today, atomically.
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const updated = await prisma.$transaction(async (tx) => {
      const max = await tx.appointment.aggregate({
        where: {
          practiceId: guard.staff.practiceId,
          checkedInAt: { gte: startOfDay },
        },
        _max: { queueNumber: true },
      });
      return tx.appointment.update({
        where: { id },
        data: {
          status: "CHECKED_IN",
          queueNumber: (max._max.queueNumber ?? 0) + 1,
          checkedInAt: now,
        },
      });
    });
    publishPracticeEvent(guard.staff.practiceId, "appointments");
    await audit({
      action: "appointment.check_in",
      actorId: guard.session.sub,
      actorRole: guard.session.role,
      resourceType: "appointment",
      resourceId: id,
      patientId: appointment.patientId,
      practiceId: guard.staff.practiceId,
      details: { queueNumber: updated.queueNumber },
      request,
    });
    await notify({
      userId: patientUser.id,
      type: "QUEUE_CHECKED_IN",
      channel: "SMS",
      recipient: appointment.patient.phone,
      title: `You are number ${updated.queueNumber} in the queue`,
      body: `Checked in at ${practiceName}. Your queue number is ${updated.queueNumber}. Follow the live queue at /waiting-room.`,
      data: { appointmentId: id, queueNumber: updated.queueNumber },
    });
    return NextResponse.json({ appointment: updated });
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: ACTION_TO[action],
      ...(action === "start_consult" ? { startedAt: now } : {}),
      ...(action === "complete" ? { completedAt: now } : {}),
      ...(action === "cancel"
        ? {
            cancelReason:
              typeof body.reason === "string" && body.reason.trim()
                ? body.reason.trim().slice(0, 300)
                : "Cancelled by practice",
          }
        : {}),
    },
  });

  publishPracticeEvent(guard.staff.practiceId, "appointments");
  await audit({
    action: `appointment.${action}`,
    actorId: guard.session.sub,
    actorRole: guard.session.role,
    resourceType: "appointment",
    resourceId: id,
    patientId: appointment.patientId,
    practiceId: guard.staff.practiceId,
    details: { from: appointment.status, to: updated.status },
    request,
  });

  const when = appointment.scheduledAt.toLocaleString();
  if (action === "confirm") {
    await notify({
      userId: patientUser.id,
      type: "BOOKING_CONFIRMED",
      channel: "EMAIL",
      recipient: patientUser.email,
      title: "Appointment confirmed",
      body: `Your appointment at ${practiceName} on ${when} is confirmed.`,
      data: { appointmentId: id },
    });
  } else if (action === "cancel") {
    await notify({
      userId: patientUser.id,
      type: "BOOKING_CANCELLED",
      channel: "EMAIL",
      recipient: patientUser.email,
      title: "Appointment cancelled",
      body: `Your appointment at ${practiceName} on ${when} was cancelled by the practice. Please rebook or contact us.`,
      data: { appointmentId: id },
    });
  } else if (action === "start_consult") {
    // Tell the next waiting patient they're up.
    const next = await prisma.appointment.findFirst({
      where: {
        practiceId: guard.staff.practiceId,
        status: "CHECKED_IN",
        id: { not: id },
      },
      orderBy: { queueNumber: "asc" },
      include: {
        patient: { select: { phone: true, user: { select: { id: true } } } },
      },
    });
    if (next) {
      await notify({
        userId: next.patient.user.id,
        type: "QUEUE_NEXT",
        channel: "SMS",
        recipient: next.patient.phone,
        title: "You're next",
        body: `You are next in the queue at ${practiceName} (number ${next.queueNumber}). Please stay close to the consultation rooms.`,
        data: { appointmentId: next.id, queueNumber: next.queueNumber },
      });
    }
  }

  return NextResponse.json({ appointment: updated });
}
