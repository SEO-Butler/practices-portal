import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { publishPracticeEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const CLINICAL_ROLES = ["NURSE", "DOCTOR", "MANAGER"];

// Photo/document upload onto a case. The patient who owns the case may
// upload (e.g. a photo of a rash); clinical staff may too. Multipart form
// with a single "file" field. Stored inline in Postgres, 2 MB cap.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await context.params;

  const medicalCase = await prisma.medicalCase.findUnique({
    where: { id },
    select: {
      id: true,
      patientId: true,
      patient: { select: { userId: true } },
      appointment: { select: { practiceId: true } },
    },
  });
  if (!medicalCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const isOwner =
    session.role === "PATIENT" && medicalCase.patient.userId === session.sub;
  const isClinical = CLINICAL_ROLES.includes(session.role);
  if (!isOwner && !isClinical) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Multipart form data expected" },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP images or PDF documents are allowed" },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 2 MB" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const attachment = await prisma.attachment.create({
    data: {
      caseId: medicalCase.id,
      patientId: medicalCase.patientId,
      uploadedById: session.sub,
      filename: (file.name || "upload").slice(0, 200),
      mimeType: file.type,
      sizeBytes: bytes.length,
      data: bytes,
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  if (medicalCase.appointment) {
    publishPracticeEvent(medicalCase.appointment.practiceId, "cases");
  }
  await audit({
    action: "attachment.uploaded",
    actorId: session.sub,
    actorRole: session.role,
    resourceType: "attachment",
    resourceId: attachment.id,
    patientId: medicalCase.patientId,
    practiceId: medicalCase.appointment?.practiceId ?? null,
    details: { filename: attachment.filename, sizeBytes: attachment.sizeBytes },
    request,
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
