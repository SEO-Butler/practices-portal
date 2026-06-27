import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// The data served here is APPROVED-only and public-by-design (consumed by
// static systeme.io pages), so a wildcard origin is intentional.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const PUBLIC_ID = /^[a-z0-9-]+$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;

  if (!PUBLIC_ID.test(publicId)) {
    return NextResponse.json(
      { error: "Invalid ID format" },
      { status: 400, headers: corsHeaders },
    );
  }

  const practice = await prisma.practice.findFirst({
    where: { publicId, status: "APPROVED" },
  });

  if (!practice) {
    return NextResponse.json(
      { error: "Practice not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  // Flat snake_case shape matching the legacy practices-api contract so
  // existing systeme.io pages stay compatible. Keys are always present.
  return NextResponse.json(
    {
      practice_name: practice.practiceName,
      doctor_name: practice.doctorName,
      specialty: practice.specialty,
      phone: practice.phone,
      email: practice.email,
      address: practice.address,
      hours: practice.hours,
      logo: practice.logoUrl ?? null,
      photo: practice.photoUrl ?? null,
      about: practice.about,
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
