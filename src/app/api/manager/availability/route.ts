import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { parseTimeToMinutes } from "@/lib/slots";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff(["MANAGER"]);
  if (!guard.ok) return guard.response;

  const rules = await prisma.availabilityRule.findMany({
    where: { doctor: { practiceId: guard.staff.practiceId } },
    orderBy: [{ doctorId: "asc" }, { weekday: "asc" }, { startMinute: "asc" }],
    include: {
      doctor: { select: { id: true, title: true, firstName: true, lastName: true } },
    },
  });
  return NextResponse.json({ rules });
}

// Manager defines a doctor's weekly bookable hours.
export async function POST(request: Request) {
  const guard = await requireStaff(["MANAGER"]);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const doctorId = typeof body.doctorId === "string" ? body.doctorId : "";
  const weekday = Number(body.weekday);
  const startMinute = parseTimeToMinutes(body.startTime);
  const endMinute = parseTimeToMinutes(body.endTime);
  const slotMinutes = Number(body.slotMinutes ?? 30);

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: "Invalid weekday" }, { status: 400 });
  }
  if (startMinute === null || endMinute === null) {
    return NextResponse.json(
      { error: "startTime and endTime must be HH:MM" },
      { status: 400 },
    );
  }
  if (endMinute <= startMinute) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(slotMinutes) || slotMinutes < 5 || slotMinutes > 120) {
    return NextResponse.json(
      { error: "Slot length must be 5–120 minutes" },
      { status: 400 },
    );
  }

  const doctor = await prisma.staffProfile.findFirst({
    where: {
      id: doctorId,
      practiceId: guard.staff.practiceId,
      user: { role: "DOCTOR" },
    },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor not found at this practice" },
      { status: 404 },
    );
  }

  const overlap = await prisma.availabilityRule.findFirst({
    where: {
      doctorId,
      weekday,
      startMinute: { lt: endMinute },
      endMinute: { gt: startMinute },
    },
  });
  if (overlap) {
    return NextResponse.json(
      { error: "This overlaps an existing rule for that day" },
      { status: 409 },
    );
  }

  const rule = await prisma.availabilityRule.create({
    data: { doctorId, weekday, startMinute, endMinute, slotMinutes },
    include: {
      doctor: { select: { id: true, title: true, firstName: true, lastName: true } },
    },
  });
  return NextResponse.json({ rule }, { status: 201 });
}
