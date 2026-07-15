import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { parseVitals } from "@/lib/clinic";
import { publishPracticeEvent } from "@/lib/events";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Nurse station vitals capture, tied to a checked-in appointment at the
// nurse's own practice. Doctors and managers may also record.
export async function POST(request: Request) {
  const guard = await requireStaff(["NURSE", "DOCTOR", "MANAGER"]);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const appointmentId =
    typeof body.appointmentId === "string" ? body.appointmentId : "";
  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
  }

  const parsed = parseVitals(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, practiceId: guard.staff.practiceId },
    include: { case: { select: { id: true } } },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (!["CHECKED_IN", "IN_CONSULT"].includes(appointment.status)) {
    return NextResponse.json(
      { error: "Patient must be checked in to capture vitals" },
      { status: 409 },
    );
  }

  const record = await prisma.vitalsRecord.create({
    data: {
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      caseId: appointment.case?.id ?? null,
      recordedById: guard.session.sub,
      source: "NURSE",
      ...parsed.vitals,
    },
  });
  publishPracticeEvent(guard.staff.practiceId, "vitals");
  await audit({
    action: "vitals.recorded",
    actorId: guard.session.sub,
    actorRole: guard.session.role,
    resourceType: "vitals",
    resourceId: record.id,
    patientId: appointment.patientId,
    practiceId: guard.staff.practiceId,
    details: { source: "NURSE", appointmentId: appointment.id },
    request,
  });
  return NextResponse.json({ vitals: record }, { status: 201 });
}
