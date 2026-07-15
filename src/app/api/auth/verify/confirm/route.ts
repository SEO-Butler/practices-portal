import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

  const token = await consumeEmailToken(raw, "VERIFY");
  if (!token) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired" },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
