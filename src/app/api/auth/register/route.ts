import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSessionToken, hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { sessionCookieOptions, createDbSession } from "@/lib/session";
import { EMAIL_RE, validPassword } from "@/lib/clinic";
import { issueEmailToken } from "@/lib/email-tokens";
import { appUrl } from "@/lib/notify";
import { registerLimiter, tooManyRequests } from "@/lib/rate-limit";
import { audit, requestMeta } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Patient self-registration. Staff accounts are created by a manager via
// /api/manager/staff, never here.
export async function POST(request: Request) {
  const ip = requestMeta(request).ip ?? "unknown";
  const check = registerLimiter().check(`ip:${ip}`);
  if (!check.allowed) return tooManyRequests(check.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!validPassword(body.password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name required" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(body.password),
      role: "PATIENT",
      patientProfile: {
        create: { firstName, lastName, phone },
      },
    },
  });

  // Verification link goes out via the notification pipeline (webhook or
  // simulated); registration itself never blocks on it.
  await issueEmailToken(user, "VERIFY", appUrl(request));

  const session = await createDbSession(user.id, request);
  const token = createSessionToken({
    sub: user.id,
    role: "PATIENT",
    sid: session.id,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  await audit({
    action: "auth.register",
    actorId: user.id,
    actorEmail: user.email,
    actorRole: "PATIENT",
    request,
  });

  return NextResponse.json({ role: "PATIENT", home: "/patient" }, { status: 201 });
}
