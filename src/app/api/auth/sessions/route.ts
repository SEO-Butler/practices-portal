import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, revokeUserSessions } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// The signed-in user's active sessions (devices).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const sessions = await prisma.session.findMany({
    where: {
      userId: session.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      ip: true,
      userAgent: true,
    },
  });
  return NextResponse.json({
    sessions: sessions.map((s) => ({ ...s, current: s.id === session.sid })),
  });
}

// "Sign out everywhere else" — revokes all sessions except the current one.
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const revoked = await revokeUserSessions(session.sub, session.sid);
  await audit({
    action: "auth.sessions_revoked",
    actorId: session.sub,
    actorRole: session.role,
    details: { revoked },
    request,
  });
  return NextResponse.json({ revoked });
}
