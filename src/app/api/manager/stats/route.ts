import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff(["MANAGER"]);
  if (!guard.ok) return guard.response;
  const practiceId = guard.staff.practiceId;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const weekAgo = new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [todayByStatus, weekTotal, pendingRequests, staffCount, waitingNow] =
    await Promise.all([
      prisma.appointment.groupBy({
        by: ["status"],
        where: {
          practiceId,
          scheduledAt: { gte: startOfDay, lt: endOfDay },
        },
        _count: { _all: true },
      }),
      prisma.appointment.count({
        where: { practiceId, scheduledAt: { gte: weekAgo, lt: endOfDay } },
      }),
      prisma.appointment.count({
        where: { practiceId, status: "REQUESTED" },
      }),
      prisma.staffProfile.count({ where: { practiceId } }),
      prisma.appointment.count({
        where: {
          practiceId,
          status: { in: ["CHECKED_IN", "IN_CONSULT"] },
          checkedInAt: { gte: startOfDay },
        },
      }),
    ]);

  return NextResponse.json({
    today: Object.fromEntries(
      todayByStatus.map((row) => [row.status, row._count._all]),
    ),
    weekTotal,
    pendingRequests,
    staffCount,
    waitingNow,
  });
}
