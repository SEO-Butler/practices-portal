import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { STAFF_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { publishPracticeEvent } from "@/lib/events";
import { resolveBooking, ACTIVE_APPOINTMENT_STATUSES } from "@/lib/slots";

export const dynamic = "force-dynamic";

// Practice-scoped appointment list. ?date=YYYY-MM-DD (default today),
// ?status=..., ?mine=1 restricts a doctor to their own patients.
export async function GET(request: Request) {
  const guard = await requireStaff(STAFF_ROLES);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const status = url.searchParams.get("status");
  const mine = url.searchParams.get("mine") === "1";
  const all = url.searchParams.get("all") === "1";

  const day = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
  if (Number.isNaN(day.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      practiceId: guard.staff.practiceId,
      ...(all ? {} : { scheduledAt: { gte: day, lt: nextDay } }),
      ...(status ? { status: status as never } : {}),
      ...(mine && guard.session.role === "DOCTOR"
        ? { doctorId: guard.staff.id }
        : {}),
    },
    orderBy: [{ queueNumber: "asc" }, { scheduledAt: "asc" }],
    take: 200,
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      doctor: { select: { id: true, title: true, firstName: true, lastName: true } },
      case: { select: { id: true, complaint: true, status: true } },
      vitals: { select: { id: true, source: true }, take: 1 },
    },
  });

  return NextResponse.json({
    appointments,
    role: guard.session.role,
    practiceId: guard.staff.practiceId,
  });
}

class SlotError extends Error {}

// Front desk creates an appointment on a patient's behalf:
// mode "walk_in"  → immediate CHECKED_IN with the next queue number
// mode "scheduled"→ slot-validated booking, created directly as CONFIRMED
export async function POST(request: Request) {
  const guard = await requireStaff(["RECEPTIONIST", "MANAGER"]);
  if (!guard.ok) return guard.response;
  const practiceId = guard.staff.practiceId;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patientId = typeof body.patientId === "string" ? body.patientId : "";
  const doctorId =
    typeof body.doctorId === "string" && body.doctorId ? body.doctorId : null;
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const mode = body.mode === "walk_in" ? "walk_in" : "scheduled";

  if (!reason) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }
  const patient = await prisma.patientProfile.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      firstName: true,
      phone: true,
      user: { select: { id: true, email: true } },
    },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }
  if (doctorId) {
    const doctor = await prisma.staffProfile.findFirst({
      where: { id: doctorId, practiceId, user: { role: "DOCTOR" } },
      select: { id: true },
    });
    if (!doctor) {
      return NextResponse.json(
        { error: "Doctor not found at this practice" },
        { status: 400 },
      );
    }
  }

  const now = new Date();

  if (mode === "walk_in") {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const appointment = await prisma.$transaction(async (tx) => {
      const max = await tx.appointment.aggregate({
        where: { practiceId, checkedInAt: { gte: startOfDay } },
        _max: { queueNumber: true },
      });
      return tx.appointment.create({
        data: {
          practiceId,
          patientId: patient.id,
          doctorId,
          scheduledAt: now,
          reason,
          status: "CHECKED_IN",
          queueNumber: (max._max.queueNumber ?? 0) + 1,
          checkedInAt: now,
        },
      });
    });
    publishPracticeEvent(practiceId, "appointments");
    await audit({
      action: "appointment.walk_in",
      actorId: guard.session.sub,
      actorRole: guard.session.role,
      resourceType: "appointment",
      resourceId: appointment.id,
      patientId: patient.id,
      practiceId,
      details: { queueNumber: appointment.queueNumber },
      request,
    });
    await notify({
      userId: patient.user.id,
      type: "QUEUE_CHECKED_IN",
      channel: "SMS",
      recipient: patient.phone,
      title: `You are number ${appointment.queueNumber} in the queue`,
      body: `Welcome, ${patient.firstName}. Your queue number is ${appointment.queueNumber}.`,
      data: { appointmentId: appointment.id, queueNumber: appointment.queueNumber },
    });
    return NextResponse.json({ appointment }, { status: 201 });
  }

  const scheduledAt = new Date(
    typeof body.scheduledAt === "string" ? body.scheduledAt : "",
  );
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < now.getTime()) {
    return NextResponse.json(
      { error: "A future slot time is required" },
      { status: 400 },
    );
  }

  const rules = await prisma.availabilityRule.findMany({
    where: {
      doctor: { practiceId, ...(doctorId ? { id: doctorId } : {}) },
      weekday: scheduledAt.getDay(),
    },
  });
  if (rules.length === 0) {
    return NextResponse.json(
      { error: "No bookable hours on that day" },
      { status: 400 },
    );
  }
  const dayStart = new Date(scheduledAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  let appointment;
  try {
    appointment = await prisma.$transaction(async (tx) => {
      const busy = await tx.appointment.findMany({
        where: {
          practiceId,
          scheduledAt: { gte: dayStart, lt: dayEnd },
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        },
        select: { doctorId: true, scheduledAt: true },
      });
      const resolved = resolveBooking(rules, doctorId, scheduledAt, busy, new Date());
      if (!resolved.ok) throw new SlotError(resolved.error);
      return tx.appointment.create({
        data: {
          practiceId,
          patientId: patient.id,
          doctorId: resolved.doctorId,
          scheduledAt,
          reason,
          status: "CONFIRMED",
        },
      });
    });
  } catch (err) {
    if (err instanceof SlotError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  publishPracticeEvent(practiceId, "appointments");
  await audit({
    action: "appointment.booked_by_staff",
    actorId: guard.session.sub,
    actorRole: guard.session.role,
    resourceType: "appointment",
    resourceId: appointment.id,
    patientId: patient.id,
    practiceId,
    request,
  });
  await notify({
    userId: patient.user.id,
    type: "BOOKING_CONFIRMED",
    channel: "EMAIL",
    recipient: patient.user.email.endsWith("@walkin.local")
      ? null
      : patient.user.email,
    title: "Appointment confirmed",
    body: `Your appointment on ${scheduledAt.toLocaleString()} was booked and confirmed by the practice.`,
    data: { appointmentId: appointment.id },
  });
  return NextResponse.json({ appointment }, { status: 201 });
}
