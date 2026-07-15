import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { STAFF_ROLES } from "@/lib/auth";
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
      case: clinical ? { include: { vitals: { orderBy: { recordedAt: "desc" } } } } : false,
      vitals: clinical ? { orderBy: { recordedAt: "desc" } } : false,
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  return NextResponse.json({ appointment, clinical });
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
  return NextResponse.json({ appointment: updated });
}
