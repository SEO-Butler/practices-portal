import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/session";
import { notify } from "@/lib/notify";
import { publishPracticeEvent } from "@/lib/events";
import { resolveBooking, ACTIVE_APPOINTMENT_STATUSES } from "@/lib/slots";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  const appointments = await prisma.appointment.findMany({
    where: { patientId: guard.patient.id },
    orderBy: { scheduledAt: "desc" },
    take: 50,
    include: {
      practice: { select: { practiceName: true, publicId: true } },
      doctor: { select: { title: true, firstName: true, lastName: true } },
    },
  });
  return NextResponse.json({ appointments });
}

// Online booking. The requested time must be an open slot generated from the
// doctors' availability rules; the doctor is auto-assigned when not chosen.
// Creates a REQUESTED appointment for reception to confirm.
export async function POST(request: Request) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const practiceId = typeof body.practiceId === "string" ? body.practiceId : "";
  const requestedDoctorId =
    typeof body.doctorId === "string" && body.doctorId ? body.doctorId : null;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const scheduledAtRaw = typeof body.scheduledAt === "string" ? body.scheduledAt : "";

  if (!reason) {
    return NextResponse.json({ error: "Reason for visit is required" }, { status: 400 });
  }
  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Valid date and time required" }, { status: 400 });
  }
  if (scheduledAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Appointment must be in the future" }, { status: 400 });
  }

  const practice = await prisma.practice.findFirst({
    where: { id: practiceId, status: "APPROVED" },
    select: { id: true, practiceName: true, publicId: true },
  });
  if (!practice) {
    return NextResponse.json({ error: "Practice not found" }, { status: 404 });
  }

  const rules = await prisma.availabilityRule.findMany({
    where: {
      doctor: {
        practiceId,
        ...(requestedDoctorId ? { id: requestedDoctorId } : {}),
      },
      weekday: scheduledAt.getDay(),
    },
  });
  if (rules.length === 0) {
    return NextResponse.json(
      { error: "No bookable hours on that day. Please pick another date." },
      { status: 400 },
    );
  }

  const dayStart = new Date(scheduledAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Validate the slot and (re-)check the conflict inside one transaction so
  // two simultaneous bookings can't take the same doctor + time.
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const busy = await tx.appointment.findMany({
        where: {
          practiceId,
          scheduledAt: { gte: dayStart, lt: dayEnd },
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        },
        select: { doctorId: true, scheduledAt: true },
      });
      const resolved = resolveBooking(
        rules,
        requestedDoctorId,
        scheduledAt,
        busy,
        new Date(),
      );
      if (!resolved.ok) throw new SlotError(resolved.error);

      return tx.appointment.create({
        data: {
          practiceId,
          patientId: guard.patient.id,
          doctorId: resolved.doctorId,
          scheduledAt,
          reason,
        },
        include: {
          practice: { select: { practiceName: true } },
          doctor: { select: { title: true, firstName: true, lastName: true } },
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
  await notify({
    userId: guard.session.sub,
    type: "BOOKING_REQUESTED",
    channel: "EMAIL",
    recipient: (await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { email: true },
    }))?.email,
    title: "Booking request received",
    body: `Your booking at ${created.practice.practiceName ?? "the practice"} on ${scheduledAt.toLocaleString()} was received and is awaiting confirmation.`,
    data: { appointmentId: created.id },
  });

  return NextResponse.json({ appointment: created }, { status: 201 });
}

class SlotError extends Error {}
