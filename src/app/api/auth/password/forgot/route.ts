import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { issueEmailToken } from "@/lib/email-tokens";
import { appUrl } from "@/lib/notify";
import { forgotLimiter, tooManyRequests } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Always responds 200 — no account enumeration.
export async function POST(request: Request) {
  const ip = requestMeta(request).ip ?? "unknown";
  const check = forgotLimiter().check(`ip:${ip}`);
  if (!check.allowed) return tooManyRequests(check.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await issueEmailToken(user, "RESET", appUrl(request));
    }
  }
  return NextResponse.json({
    ok: true,
    message: "If that email is registered, a reset link has been sent.",
  });
}
