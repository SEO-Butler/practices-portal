import { NextResponse } from "next/server";
import { pushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

// Public VAPID application server key for pushManager.subscribe().
// { key: null } signals that push is not configured on this deployment.
export async function GET() {
  return NextResponse.json({
    key: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
  });
}
