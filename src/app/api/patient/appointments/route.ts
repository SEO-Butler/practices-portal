import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/session";

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

// Online booking: creates a REQUESTED appointment for reception to confirm.
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
  const doctorId = typeof body.doctorId === "string" && body.doctorId ? body.doctorId : null;
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
    select: { id: true },
  });
  if (!practice) {
    return NextResponse.json({ error: "Practice not found" }, { status: 404 });
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

  const appointment = await prisma.appointment.create({
    data: {
      practiceId,
      patientId: guard.patient.id,
      doctorId,
      scheduledAt,
      reason,
    },
    include: {
      practice: { select: { practiceName: true } },
      doctor: { select: { title: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ appointment }, { status: 201 });
}
