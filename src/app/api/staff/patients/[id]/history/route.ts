import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ATTACHMENT_META = {
  select: {
    id: true,
    filename: true,
    mimeType: true,
    sizeBytes: true,
    createdAt: true,
  },
} as const;

// Longitudinal patient view for clinicians: full case history with all
// clinical records, past appointments and vitals. Access is audited.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(["NURSE", "DOCTOR", "MANAGER"]);
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  const patient = await prisma.patientProfile.findUnique({
    where: { id },
    include: {
      cases: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          diagnoses: { orderBy: { createdAt: "desc" } },
          prescriptions: { orderBy: { createdAt: "desc" } },
          sickNotes: { orderBy: { createdAt: "desc" } },
          attachments: ATTACHMENT_META,
          appointment: {
            select: {
              scheduledAt: true,
              practice: { select: { practiceName: true } },
            },
          },
        },
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 20,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          reason: true,
          doctor: { select: { title: true, firstName: true, lastName: true } },
        },
      },
      vitals: { orderBy: { recordedAt: "asc" }, take: 100 },
    },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  await audit({
    action: "history.view",
    actorId: guard.session.sub,
    actorRole: guard.session.role,
    resourceType: "patientProfile",
    resourceId: patient.id,
    patientId: patient.id,
    practiceId: guard.staff.practiceId,
    request,
  });

  return NextResponse.json({ patient });
}
