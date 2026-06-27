import { NextResponse } from "next/server";
import * as health from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUp = await health.checkDatabase();
  return NextResponse.json(
    { status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down" },
    { status: dbUp ? 200 : 503 },
  );
}
