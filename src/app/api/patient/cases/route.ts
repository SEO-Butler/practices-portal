import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/session";
import { parseVitals } from "@/lib/clinic";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  const cases = await prisma.medicalCase.findMany({
    where: { patientId: guard.patient.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      vitals: { orderBy: { recordedAt: "desc" } },
      diagnoses: { orderBy: { createdAt: "desc" } },
      prescriptions: { orderBy: { createdAt: "desc" } },
      sickNotes: { orderBy: { createdAt: "desc" } },
      attachments: {
        // Metadata only — bytes are served by /api/attachments/[id].
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
      appointment: {
        select: { scheduledAt: true, practice: { select: { practiceName: true } } },
      },
    },
  });
  return NextResponse.json({ cases });
}

// Patient opens a medical case (complaint) and may attach initial self-vitals
// in the same request.
export async function POST(request: Request) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const complaint = typeof body.complaint === "string" ? body.complaint.trim().slice(0, 300) : "";
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 4000)
      : null;
  const appointmentId =
    typeof body.appointmentId === "string" && body.appointmentId
      ? body.appointmentId
      : null;

  if (!complaint) {
    return NextResponse.json({ error: "Complaint is required" }, { status: 400 });
  }

  if (appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId: guard.patient.id },
      include: { case: { select: { id: true } } },
    });
    if (!appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    if (appt.case) {
      return NextResponse.json(
        { error: "This appointment already has a case" },
        { status: 409 },
      );
    }
  }

  // Optional initial self vitals, validated before anything is written.
  let vitalsData: ReturnType<typeof parseVitals> | null = null;
  if (body.vitals && typeof body.vitals === "object") {
    vitalsData = parseVitals(body.vitals as Record<string, unknown>);
    if (!vitalsData.ok) {
      return NextResponse.json({ error: vitalsData.error }, { status: 400 });
    }
  }

  const created = await prisma.medicalCase.create({
    data: {
      patientId: guard.patient.id,
      appointmentId,
      complaint,
      description,
      ...(vitalsData?.ok
        ? {
            vitals: {
              create: {
                patientId: guard.patient.id,
                appointmentId,
                recordedById: guard.session.sub,
                source: "SELF",
                ...vitalsData.vitals,
              },
            },
          }
        : {}),
    },
    include: { vitals: true },
  });

  await audit({
    action: "case.created",
    actorId: guard.session.sub,
    actorRole: "PATIENT",
    resourceType: "case",
    resourceId: created.id,
    patientId: guard.patient.id,
    details: { withVitals: created.vitals.length > 0 },
    request,
  });
  return NextResponse.json({ case: created }, { status: 201 });
}
