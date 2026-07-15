import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// The signed-in user's alerts feed (all roles).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: session.sub, readAt: null },
    }),
  ]);
  return NextResponse.json({ notifications, unread });
}

// Mark all as read.
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  await prisma.notification.updateMany({
    where: { userId: session.sub, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
