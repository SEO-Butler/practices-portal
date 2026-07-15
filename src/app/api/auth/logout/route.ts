import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { revokeSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      await revokeSession(payload.sid);
      await audit({
        action: "auth.logout",
        actorId: payload.sub,
        actorRole: payload.role,
        resourceType: "session",
        resourceId: payload.sid,
        request,
      });
    }
  }
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
