import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { EMAIL_RE } from "@/lib/clinic";
import { audit } from "@/lib/audit";
import { issueEmailToken } from "@/lib/email-tokens";
import { appUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";

const FRONT_DESK = ["RECEPTIONIST", "MANAGER"] as const;

// Patient search for the front desk: name, phone or email, demographics
// only (no clinical data on this endpoint). Searches are audited.
export async function GET(request: Request) {
  const guard = await requireStaff([...FRONT_DESK]);
  if (!guard.ok) return guard.response;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ patients: [], practiceId: guard.staff.practiceId });
  }

  const words = q.split(/\s+/).slice(0, 3);
  const patients = await prisma.patientProfile.findMany({
    where: {
      AND: words.map((word) => ({
        OR: [
          { firstName: { contains: word, mode: "insensitive" as const } },
          { lastName: { contains: word, mode: "insensitive" as const } },
          { phone: { contains: word } },
          { user: { email: { contains: word.toLowerCase() } } },
        ],
      })),
    },
    take: 10,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      medicalAidName: true,
      user: { select: { email: true } },
    },
  });

  await audit({
    action: "patient.search",
    actorId: guard.session.sub,
    actorRole: guard.session.role,
    practiceId: guard.staff.practiceId,
    details: { query: q, results: patients.length },
    request,
  });

  return NextResponse.json({
    practiceId: guard.staff.practiceId,
    patients: patients.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      dateOfBirth: p.dateOfBirth,
      medicalAidName: p.medicalAidName,
      email: p.user.email.endsWith("@walkin.local") ? null : p.user.email,
    })),
  });
}

// Walk-in registration: creates a patient who may not use the app at all.
// With an email, an account-claim (password reset) link goes out via the
// notification pipeline; without one, a placeholder login is generated.
export async function POST(request: Request) {
  const guard = await requireStaff([...FRONT_DESK]);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const phone =
    typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const emailRaw =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  let dateOfBirth: Date | null = null;
  if (typeof body.dateOfBirth === "string" && body.dateOfBirth) {
    dateOfBirth = new Date(body.dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime())) {
      return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
    }
  }

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name required" },
      { status: 400 },
    );
  }
  if (emailRaw && !EMAIL_RE.test(emailRaw)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (emailRaw) {
    const existing = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (existing) {
      return NextResponse.json(
        { error: "A patient with this email already exists — search for them instead" },
        { status: 409 },
      );
    }
  }

  // Placeholder address keeps User.email unique for offline patients; it is
  // hidden again by the search endpoint above.
  const email =
    emailRaw || `${randomBytes(8).toString("hex")}@walkin.local`;

  const user = await prisma.user.create({
    data: {
      email,
      // Random unguessable password; claimable via the emailed reset link.
      passwordHash: hashPassword(randomBytes(24).toString("base64url")),
      role: "PATIENT",
      mustChangePassword: true,
      patientProfile: {
        create: { firstName, lastName, phone, dateOfBirth },
      },
    },
    include: { patientProfile: true },
  });

  if (emailRaw) {
    await issueEmailToken(user, "RESET", appUrl(request));
  }

  await audit({
    action: "patient.registered_walkin",
    actorId: guard.session.sub,
    actorRole: guard.session.role,
    resourceType: "patientProfile",
    resourceId: user.patientProfile!.id,
    patientId: user.patientProfile!.id,
    practiceId: guard.staff.practiceId,
    details: { invited: Boolean(emailRaw) },
    request,
  });

  return NextResponse.json(
    {
      patient: {
        id: user.patientProfile!.id,
        firstName,
        lastName,
        phone,
        dateOfBirth,
        medicalAidName: null,
        email: emailRaw || null,
      },
      invited: Boolean(emailRaw),
    },
    { status: 201 },
  );
}
