import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { initialsOf } from "@/lib/clinic";

export const dynamic = "force-dynamic";

/**
 * Public waiting-room board. Anonymized by design: queue number, patient
 * initials, doctor and status only — no names or clinical data.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const practiceId = url.searchParams.get("practiceId");
  if (!practiceId) {
    return NextResponse.json({ error: "practiceId required" }, { status: 400 });
  }

  const practice = await prisma.practice.findFirst({
    where: { id: practiceId, status: "APPROVED" },
    select: { id: true, practiceName: true, publicId: true },
  });
  if (!practice) {
    return NextResponse.json({ error: "Practice not found" }, { status: 404 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const entries = await prisma.appointment.findMany({
    where: {
      practiceId,
      status: { in: ["CHECKED_IN", "IN_CONSULT"] },
      checkedInAt: { gte: startOfDay },
    },
    orderBy: [{ status: "desc" }, { queueNumber: "asc" }],
    select: {
      queueNumber: true,
      status: true,
      checkedInAt: true,
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { title: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({
    practice: { id: practice.id, name: practice.practiceName ?? practice.publicId },
    asOf: new Date().toISOString(),
    queue: entries.map((e) => ({
      number: e.queueNumber,
      patient: initialsOf(e.patient.firstName, e.patient.lastName),
      doctor: e.doctor
        ? `${e.doctor.title ? e.doctor.title + " " : ""}${e.doctor.firstName} ${e.doctor.lastName}`
        : null,
      status: e.status === "IN_CONSULT" ? "In consultation" : "Waiting",
      checkedInAt: e.checkedInAt,
    })),
  });
}
