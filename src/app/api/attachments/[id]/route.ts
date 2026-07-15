import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const CLINICAL_ROLES = ["NURSE", "DOCTOR", "MANAGER"];

// Serves attachment bytes. Allowed: the patient who owns the record, or
// clinical staff (every staff view is audited).
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await context.params;

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const owner = await prisma.patientProfile.findUnique({
    where: { id: attachment.patientId },
    select: { userId: true },
  });
  const isOwner = session.role === "PATIENT" && owner?.userId === session.sub;
  const isClinical = CLINICAL_ROLES.includes(session.role);
  if (!isOwner && !isClinical) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isClinical) {
    await audit({
      action: "attachment.viewed",
      actorId: session.sub,
      actorRole: session.role,
      resourceType: "attachment",
      resourceId: attachment.id,
      patientId: attachment.patientId,
      details: { filename: attachment.filename },
      request,
    });
  }

  return new NextResponse(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.sizeBytes),
      "Content-Disposition": `inline; filename="${attachment.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
