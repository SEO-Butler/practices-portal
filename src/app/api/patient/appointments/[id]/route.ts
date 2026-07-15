import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/session";
import { publishPracticeEvent } from "@/lib/events";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Patients may only cancel their own not-yet-checked-in appointments.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // body optional
  }
  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, patientId: guard.patient.id },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (!["REQUESTED", "CONFIRMED"].includes(appointment.status)) {
    return NextResponse.json(
      { error: "This appointment can no longer be cancelled online" },
      { status: 409 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED", cancelReason: "Cancelled by patient" },
  });
  publishPracticeEvent(appointment.practiceId, "appointments");
  await audit({
    action: "appointment.cancelled_by_patient",
    actorId: guard.session.sub,
    actorRole: "PATIENT",
    resourceType: "appointment",
    resourceId: id,
    patientId: guard.patient.id,
    practiceId: appointment.practiceId,
    request,
  });
  return NextResponse.json({ appointment: updated });
}
