import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
  type SessionRole,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Reads and verifies the session cookie. Null when absent/invalid. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
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
