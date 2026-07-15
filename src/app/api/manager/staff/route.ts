import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { EMAIL_RE, validPassword } from "@/lib/clinic";

export const dynamic = "force-dynamic";

const STAFF_CREATABLE = ["RECEPTIONIST", "NURSE", "DOCTOR", "MANAGER"] as const;

export async function GET() {
  const guard = await requireStaff(["MANAGER"]);
  if (!guard.ok) return guard.response;

  const staff = await prisma.staffProfile.findMany({
    where: { practiceId: guard.staff.practiceId },
    orderBy: [{ lastName: "asc" }],
    include: { user: { select: { email: true, role: true, createdAt: true } } },
  });
  return NextResponse.json({ staff });
}

// Manager creates staff accounts (receptionist, nurse, doctor, manager) for
// their own practice.
export async function POST(request: Request) {
  const guard = await requireStaff(["MANAGER"]);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  const specialty =
    typeof body.specialty === "string" && body.specialty.trim()
      ? body.specialty.trim()
      : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!validPassword(body.password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (!(STAFF_CREATABLE as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
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
      role: role as (typeof STAFF_CREATABLE)[number],
      // Temporary password issued by the manager — force a change on first login.
      mustChangePassword: true,
      staffProfile: {
        create: {
          practiceId: guard.staff.practiceId,
          firstName,
          lastName,
          title,
          specialty,
        },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      staffProfile: true,
    },
  });

  return NextResponse.json({ staff: user }, { status: 201 });
}
