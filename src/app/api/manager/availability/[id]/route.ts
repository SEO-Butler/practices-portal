import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(["MANAGER"]);
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  const rule = await prisma.availabilityRule.findFirst({
    where: { id, doctor: { practiceId: guard.staff.practiceId } },
  });
  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
  await prisma.availabilityRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
