import { createHmac } from "crypto";
import { prisma } from "@/lib/db";
import type { NotificationChannel } from "@prisma/client";

// Outbound notification pipeline. Every event is persisted (doubles as the
// user's in-app alerts feed) and then dispatched to WEBHOOK_URL where a
// 3rd-party integration performs the actual email/SMS delivery. Without
// WEBHOOK_URL the event is marked SIMULATED — nothing leaves the app.

export interface NotifyInput {
  userId: string;
  type: string;
  channel: NotificationChannel;
  recipient?: string | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** HMAC-SHA256 hex signature for webhook payloads (X-Webhook-Signature). */
export function signWebhookBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Persists and dispatches one notification. Never throws — notification
 * failure must not break the business action that triggered it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  let id: string;
  try {
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        channel: input.channel,
        recipient: input.recipient ?? null,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as never,
      },
    });
    id = row.id;
  } catch (err) {
    console.error("[notify] failed to persist notification", err);
    return;
  }

  const url = process.env.WEBHOOK_URL;
  if (!url) {
    await prisma.notification.update({
      where: { id },
      data: { status: "SIMULATED", sentAt: new Date() },
    });
    console.log(
      `[notify:simulated] ${input.channel} ${input.type} -> ${input.recipient ?? input.userId}: ${input.title} | ${input.body}`,
    );
    return;
  }

  const payload = JSON.stringify({
    id,
    type: input.type,
    channel: input.channel,
    recipient: input.recipient ?? null,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
    createdAt: new Date().toISOString(),
  });

  try {
    const secret = process.env.WEBHOOK_SECRET;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Webhook-Signature": signWebhookBody(payload, secret) } : {}),
      },
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
    await prisma.notification.update({
      where: { id },
      data: res.ok
        ? { status: "SENT", sentAt: new Date() }
        : { status: "FAILED", error: `Webhook responded ${res.status}` },
    });
  } catch (err) {
    await prisma.notification
      .update({
        where: { id },
        data: {
          status: "FAILED",
          error: err instanceof Error ? err.message : "Webhook unreachable",
        },
      })
      .catch(() => {});
  }
}

/** Base URL for links in notifications (verify email, reset password). */
export function appUrl(request: Request): string {
  return process.env.APP_URL ?? new URL(request.url).origin;
}
