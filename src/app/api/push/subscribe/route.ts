import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Registers this browser's push subscription for the signed-in user.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sub = body.subscription as
    | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    | undefined;
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";

  if (!endpoint.startsWith("http") || !p256dh || !auth) {
    return NextResponse.json(
      { error: "A valid push subscription is required" },
      { status: 400 },
    );
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    // Endpoint reuse by a different signed-in user re-homes the subscription.
    update: { userId: session.sub, p256dh, auth },
    create: {
      userId: session.sub,
      endpoint,
      p256dh,
      auth,
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  await audit({
    action: "push.subscribed",
    actorId: session.sub,
    actorRole: session.role,
    request,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// Removes this browser's subscription (user turned push off).
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.sub },
  });
  return NextResponse.json({ ok: true });
}
