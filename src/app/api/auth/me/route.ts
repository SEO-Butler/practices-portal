import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { homePathFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      mustChangePassword: true,
      patientProfile: { select: { firstName: true, lastName: true } },
      staffProfile: {
        select: { firstName: true, lastName: true, practiceId: true },
      },
    },
  });
  if (!user) return NextResponse.json({ user: null });
  const profile = user.patientProfile ?? user.staffProfile;
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: profile ? `${profile.firstName} ${profile.lastName}` : user.email,
      home: homePathFor(session.role),
      emailVerified: user.emailVerifiedAt !== null,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
