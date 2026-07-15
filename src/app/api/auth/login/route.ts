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
import { sessionCookieOptions, createDbSession } from "@/lib/session";
import {
  loginEmailLimiter,
  loginIpLimiter,
  tooManyRequests,
} from "@/lib/rate-limit";
import { audit, requestMeta } from "@/lib/audit";

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
  const ip = requestMeta(request).ip ?? "unknown";

  const ipCheck = loginIpLimiter().check(`ip:${ip}`);
  if (!ipCheck.allowed) return tooManyRequests(ipCheck.retryAfterSec);
  const emailCheck = loginEmailLimiter().check(`email:${email}`);
  if (!emailCheck.allowed) {
    await audit({
      action: "auth.login_throttled",
      actorEmail: email,
      request,
    });
    return tooManyRequests(emailCheck.retryAfterSec);
  }

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  // Same error for unknown email and bad password — no account enumeration.
  if (!user || !password || !verifyPassword(password, user.passwordHash)) {
    await audit({ action: "auth.login_failed", actorEmail: email, request });
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  // Success clears the account's failure budget.
  loginEmailLimiter().reset(`email:${email}`);

  const role = user.role as SessionRole;
  const session = await createDbSession(user.id, request);
  const token = createSessionToken({ sub: user.id, role, sid: session.id });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  await audit({
    action: "auth.login",
    actorId: user.id,
    actorEmail: user.email,
    actorRole: role,
    resourceType: "session",
    resourceId: session.id,
    request,
  });

  return NextResponse.json({
    role,
    home: user.mustChangePassword
      ? "/account/password?required=1"
      : homePathFor(role),
    mustChangePassword: user.mustChangePassword,
  });
}
