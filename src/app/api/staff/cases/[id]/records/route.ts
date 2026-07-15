import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { audit } from "@/lib/audit";
import { publishPracticeEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

// Doctors add clinical records to a case: a diagnosis (optionally ICD-coded),
// a prescription, or a sick note. One endpoint, discriminated by `type`.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(["DOCTOR"]);
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
    select: { id: true, patientId: true },
  });
  if (!medicalCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const str = (key: string, max: number): string =>
    typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";

  const common = {
    caseId: medicalCase.id,
    patientId: medicalCase.patientId,
  };
  let created: { id: string };
  let recordType: string;

  switch (body.type) {
    case "diagnosis": {
      const description = str("description", 500);
      if (!description) {
        return NextResponse.json({ error: "Description required" }, { status: 400 });
      }
      created = await prisma.diagnosis.create({
        data: {
          ...common,
          description,
          icdCode: str("icdCode", 20) || null,
          diagnosedById: guard.session.sub,
        },
      });
      recordType = "diagnosis";
      break;
    }
    case "prescription": {
      const medication = str("medication", 200);
      const dosage = str("dosage", 100);
      const frequency = str("frequency", 100);
      if (!medication || !dosage || !frequency) {
        return NextResponse.json(
          { error: "Medication, dosage and frequency are required" },
          { status: 400 },
        );
      }
      const durationDays = body.durationDays ? Number(body.durationDays) : null;
      if (
        durationDays !== null &&
        (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365)
      ) {
        return NextResponse.json(
          { error: "Duration must be 1–365 days" },
          { status: 400 },
        );
      }
      created = await prisma.prescription.create({
        data: {
          ...common,
          medication,
          dosage,
          frequency,
          durationDays,
          instructions: str("instructions", 500) || null,
          prescribedById: guard.session.sub,
        },
      });
      recordType = "prescription";
      break;
    }
    case "sick_note": {
      const fromDate = new Date(str("fromDate", 30));
      const toDate = new Date(str("toDate", 30));
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return NextResponse.json(
          { error: "Valid from/to dates required" },
          { status: 400 },
        );
      }
      if (toDate < fromDate) {
        return NextResponse.json(
          { error: "End date must not be before start date" },
          { status: 400 },
        );
      }
      created = await prisma.sickNote.create({
        data: {
          ...common,
          fromDate,
          toDate,
          note: str("note", 500) || null,
          issuedById: guard.session.sub,
        },
      });
      recordType = "sick_note";
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown record type" }, { status: 400 });
  }

  publishPracticeEvent(guard.staff.practiceId, "cases");
  await audit({
    action: `case.${recordType}_added`,
    actorId: guard.session.sub,
    actorRole: guard.session.role,
    resourceType: recordType,
    resourceId: created.id,
    patientId: medicalCase.patientId,
    practiceId: guard.staff.practiceId,
    request,
  });

  const full = await prisma.medicalCase.findUnique({
    where: { id: medicalCase.id },
    include: {
      diagnoses: { orderBy: { createdAt: "desc" } },
      prescriptions: { orderBy: { createdAt: "desc" } },
      sickNotes: { orderBy: { createdAt: "desc" } },
    },
  });
  return NextResponse.json({ case: full }, { status: 201 });
}
