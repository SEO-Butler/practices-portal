import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public: approved practices with their doctors, for the booking form and
// the waiting-room practice selector.
export async function GET() {
  const practices = await prisma.practice.findMany({
    where: { status: "APPROVED" },
    orderBy: { practiceName: "asc" },
    select: {
      id: true,
      publicId: true,
      practiceName: true,
      specialty: true,
      address: true,
      phone: true,
      hours: true,
      staff: {
        where: { user: { role: "DOCTOR" } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          specialty: true,
        },
        orderBy: { lastName: "asc" },
      },
    },
  });

  return NextResponse.json({
    practices: practices.map((p) => ({
      id: p.id,
      publicId: p.publicId,
      name: p.practiceName ?? p.publicId,
      specialty: p.specialty,
      address: p.address,
      phone: p.phone,
      hours: p.hours,
      doctors: p.staff.map((d) => ({
        id: d.id,
        name: `${d.title ? d.title + " " : ""}${d.firstName} ${d.lastName}`,
        specialty: d.specialty,
      })),
    })),
  });
}
