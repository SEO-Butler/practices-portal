import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { slotsForDay, ACTIVE_APPOINTMENT_STATUSES } from "@/lib/slots";

export const dynamic = "force-dynamic";

// Public: available booking slots for a practice on a given day.
// ?practiceId=&date=YYYY-MM-DD[&doctorId=] — no PII, only free times.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const practiceId = url.searchParams.get("practiceId");
  const dateParam = url.searchParams.get("date");
  const doctorId = url.searchParams.get("doctorId");

  if (!practiceId || !dateParam) {
    return NextResponse.json(
      { error: "practiceId and date required" },
      { status: 400 },
    );
  }
  const day = new Date(`${dateParam}T00:00:00`);
  if (Number.isNaN(day.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const rules = await prisma.availabilityRule.findMany({
    where: {
      doctor: { practiceId, ...(doctorId ? { id: doctorId } : {}) },
      weekday: day.getDay(),
    },
  });

  const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  const busy = await prisma.appointment.findMany({
    where: {
      practiceId,
      scheduledAt: { gte: day, lt: nextDay },
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    },
    select: { doctorId: true, scheduledAt: true },
  });

  const slots = slotsForDay(rules, day, busy, new Date());
  return NextResponse.json({
    slots: slots.map((s) => ({
      time: s.time.toISOString(),
      doctorIds: s.doctorIds,
    })),
  });
}
