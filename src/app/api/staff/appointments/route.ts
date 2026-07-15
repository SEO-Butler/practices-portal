import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { STAFF_ROLES } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Practice-scoped appointment list. ?date=YYYY-MM-DD (default today),
// ?status=..., ?mine=1 restricts a doctor to their own patients.
export async function GET(request: Request) {
  const guard = await requireStaff(STAFF_ROLES);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const status = url.searchParams.get("status");
  const mine = url.searchParams.get("mine") === "1";
  const all = url.searchParams.get("all") === "1";

  const day = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
  if (Number.isNaN(day.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      practiceId: guard.staff.practiceId,
      ...(all ? {} : { scheduledAt: { gte: day, lt: nextDay } }),
      ...(status ? { status: status as never } : {}),
      ...(mine && guard.session.role === "DOCTOR"
        ? { doctorId: guard.staff.id }
        : {}),
    },
    orderBy: [{ queueNumber: "asc" }, { scheduledAt: "asc" }],
    take: 200,
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      doctor: { select: { id: true, title: true, firstName: true, lastName: true } },
      case: { select: { id: true, complaint: true, status: true } },
      vitals: { select: { id: true, source: true }, take: 1 },
    },
  });

  return NextResponse.json({ appointments, role: guard.session.role });
}
