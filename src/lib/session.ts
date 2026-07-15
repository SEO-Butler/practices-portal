import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
  type SessionRole,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
// lastSeenAt is refreshed at most this often to keep reads from writing.
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

/**
 * Reads and verifies the session cookie, then checks the server-side
 * Session row — a revoked or expired row rejects the token regardless of
 * its signature. Null when absent/invalid.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const record = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: { userId: true, revokedAt: true, expiresAt: true, lastSeenAt: true },
  });
  if (
    !record ||
    record.userId !== payload.sub ||
    record.revokedAt ||
    record.expiresAt < new Date()
  ) {
    return null;
  }

  if (Date.now() - record.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
    prisma.session
      .update({ where: { id: payload.sid }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }
  return payload;
}

/** Creates the server-side session row for a fresh sign-in. */
export async function createDbSession(userId: string, request?: Request) {
  const forwarded = request?.headers.get("x-forwarded-for");
  return prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      ip: forwarded ? forwarded.split(",")[0].trim() : null,
      userAgent: request?.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
}

export async function revokeSession(sid: string): Promise<void> {
  await prisma.session
    .updateMany({
      where: { id: sid, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => {});
}

/** Revokes every live session for a user except `keepSid` (pass null for all). */
export async function revokeUserSessions(
  userId: string,
  keepSid: string | null,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepSid ? { id: { not: keepSid } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export type Guard =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

/**
 * Role guard for route handlers. Returns the session, or a ready-made
 * 401/403 JSON response.
 */
export async function requireRole(roles: SessionRole[]): Promise<Guard> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  if (!roles.includes(session.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, session };
}

/** Staff session plus the staff profile (practice scope). 403 if no profile. */
export async function requireStaff(roles: SessionRole[]) {
  const guard = await requireRole(roles);
  if (!guard.ok) return guard;
  const staff = await prisma.staffProfile.findUnique({
    where: { userId: guard.session.sub },
  });
  if (!staff) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "No staff profile" },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, session: guard.session, staff };
}

/** Patient session plus the patient profile. 403 if no profile. */
export async function requirePatient() {
  const guard = await requireRole(["PATIENT"]);
  if (!guard.ok) return guard;
  const patient = await prisma.patientProfile.findUnique({
    where: { userId: guard.session.sub },
  });
  if (!patient) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "No patient profile" },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, session: guard.session, patient };
}

export function sessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
