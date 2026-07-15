import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  verifyPassword,
  homePathFor,
  SESSION_COOKIE,
  type SessionRole,
} from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  // Same error for unknown email and bad password — no account enumeration.
  if (!user || !password || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const role = user.role as SessionRole;
  const token = createSessionToken({ sub: user.id, role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  return NextResponse.json({
    role,
    home: user.mustChangePassword
      ? "/account/password?required=1"
      : homePathFor(role),
    mustChangePassword: user.mustChangePassword,
  });
}
