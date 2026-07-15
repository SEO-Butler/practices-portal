import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { publishPracticeEvent } from "@/lib/events";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Doctor updates a case: notes and status. Scoped to cases whose appointment
// belongs to the doctor's practice, or standalone cases of patients seen
// there today (via appointment linkage only, to keep the boundary clear).
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(["DOCTOR", "MANAGER"]);
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const medicalCase = await prisma.medicalCase.findFirst({
    where: { id, appointment: { practiceId: guard.staff.practiceId } },
  });
  if (!medicalCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.doctorNotes === "string") {
    data.doctorNotes = body.doctorNotes.trim().slice(0, 8000) || null;
  }
  if (typeof body.status === "string") {
    if (!["OPEN", "IN_PROGRESS", "CLOSED"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
    data.closedAt = body.status === "CLOSED" ? new Date() : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.medicalCase.update({ where: { id }, data });
  publishPracticeEvent(guard.staff.practiceId, "cases");
  await audit({
    action: "case.updated",
    actorId: guard.session.sub,
    actorRole: guard.session.role,
    resourceType: "case",
    resourceId: id,
    patientId: medicalCase.patientId,
    practiceId: guard.staff.practiceId,
    details: {
      fields: Object.keys(data),
      ...(typeof data.status === "string" ? { status: data.status } : {}),
    },
    request,
  });
  return NextResponse.json({ case: updated });
}
