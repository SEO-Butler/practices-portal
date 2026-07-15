import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/session";
import { parseVitals } from "@/lib/clinic";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;
  const vitals = await prisma.vitalsRecord.findMany({
    where: { patientId: guard.patient.id },
    orderBy: { recordedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ vitals });
}

// Self-captured vitals (home BP readings etc.), optionally linked to one of
// the patient's own cases.
export async function POST(request: Request) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseVitals(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let caseId: string | null = null;
  if (typeof body.caseId === "string" && body.caseId) {
    const owned = await prisma.medicalCase.findFirst({
      where: { id: body.caseId, patientId: guard.patient.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    caseId = owned.id;
  }

  const record = await prisma.vitalsRecord.create({
    data: {
      patientId: guard.patient.id,
      caseId,
      recordedById: guard.session.sub,
      source: "SELF",
      ...parsed.vitals,
    },
  });
  return NextResponse.json({ vitals: record }, { status: 201 });
}
