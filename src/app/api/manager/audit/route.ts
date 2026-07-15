import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

// Practice-scoped, read-only audit trail for the manager.
// ?action=chart.view&cursor=<id> — newest first, 50 per page.
export async function GET(request: Request) {
  const guard = await requireStaff(["MANAGER"]);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const cursor = url.searchParams.get("cursor");

  const entries = await prisma.auditLog.findMany({
    where: {
      practiceId: guard.staff.practiceId,
      ...(action ? { action: { startsWith: action } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = entries.length > 50;
  const page = hasMore ? entries.slice(0, 50) : entries;

  // Resolve actor + patient names in one pass for display.
  const actorIds = [...new Set(page.map((e) => e.actorId).filter(Boolean))] as string[];
  const patientIds = [...new Set(page.map((e) => e.patientId).filter(Boolean))] as string[];
  const [actors, patients] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: {
        id: true,
        email: true,
        staffProfile: { select: { firstName: true, lastName: true } },
        patientProfile: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.patientProfile.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  const actorName = new Map(
    actors.map((a) => {
      const p = a.staffProfile ?? a.patientProfile;
      return [a.id, p ? `${p.firstName} ${p.lastName}` : a.email];
    }),
  );
  const patientName = new Map(
    patients.map((p) => [p.id, `${p.firstName} ${p.lastName}`]),
  );

  return NextResponse.json({
    entries: page.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actorId
        ? (actorName.get(e.actorId) ?? e.actorEmail ?? "Deleted user")
        : (e.actorEmail ?? "Anonymous"),
      actorRole: e.actorRole,
      patient: e.patientId ? (patientName.get(e.patientId) ?? "Former patient") : null,
      details: e.details,
      ip: e.ip,
      createdAt: e.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
