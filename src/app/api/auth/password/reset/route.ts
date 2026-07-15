import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { validPassword } from "@/lib/clinic";
import { consumeEmailToken } from "@/lib/email-tokens";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = typeof body.token === "string" ? body.token : "";
  if (!raw) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  if (!validPassword(body.password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const token = await consumeEmailToken(raw, "RESET");
  if (!token) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired" },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: {
        passwordHash: hashPassword(body.password),
        mustChangePassword: false,
        // Owning the inbox proves the address, so a reset also verifies it.
        emailVerifiedAt: token.user.emailVerifiedAt ?? new Date(),
      },
    }),
    prisma.emailToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
