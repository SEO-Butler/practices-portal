import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { validPassword } from "@/lib/clinic";

export const dynamic = "force-dynamic";

// Signed-in password change; also clears the mustChangePassword flag set on
// manager-issued temporary staff passwords.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  if (!validPassword(body.newPassword)) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || !verifyPassword(current, user.passwordHash)) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    );
  }
  if (current === body.newPassword) {
    return NextResponse.json(
      { error: "New password must be different" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(body.newPassword), mustChangePassword: false },
  });
  return NextResponse.json({ ok: true });
}
