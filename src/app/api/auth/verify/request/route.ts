import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { issueEmailToken } from "@/lib/email-tokens";
import { appUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Resend the email-verification link for the signed-in user.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }
  await issueEmailToken(user, "VERIFY", appUrl(request));
  return NextResponse.json({ ok: true });
}
