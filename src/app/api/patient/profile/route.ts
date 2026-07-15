import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ profile: guard.patient });
}

// Self-service update of personal details. Whitelisted fields only.
const EDITABLE = [
  "firstName",
  "lastName",
  "phone",
  "address",
  "medicalAidName",
  "medicalAidNumber",
  "allergies",
  "chronicConditions",
  "emergencyContact",
] as const;

export async function PUT(request: Request) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, string | Date | null> = {};
  for (const field of EDITABLE) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === null || value === "") {
      data[field] = null;
    } else if (typeof value === "string") {
      data[field] = value.trim().slice(0, 500);
    }
  }
  if ("dateOfBirth" in body) {
    const raw = body.dateOfBirth;
    if (raw === null || raw === "") {
      data.dateOfBirth = null;
    } else if (typeof raw === "string" && !Number.isNaN(Date.parse(raw))) {
      data.dateOfBirth = new Date(raw);
    } else {
      return NextResponse.json({ error: "Invalid dateOfBirth" }, { status: 400 });
    }
  }
  if (typeof data.firstName === "string" && !data.firstName) delete data.firstName;
  if (data.firstName === null || data.lastName === null) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  const profile = await prisma.patientProfile.update({
    where: { id: guard.patient.id },
    data,
  });
  return NextResponse.json({ profile });
}
