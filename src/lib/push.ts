import webpush from "web-push";
import { prisma } from "@/lib/db";

// Web-push delivery to the user's subscribed browsers/devices. Requires
// VAPID keys in the environment (npm run push:keygen); without them push
// is silently disabled and the UI hides the enable button.

let vapidConfigured = false;

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

function ensureVapid(): boolean {
  if (!pushConfigured()) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@practices-portal.local",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    vapidConfigured = true;
  }
  return true;
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends a push message to every subscription of a user. Never throws;
 * subscriptions the push service reports gone (404/410) are deleted.
 * Returns the number of successful deliveries.
 */
export async function sendPushToUser(
  userId: string,
  message: PushMessage,
): Promise<number> {
  if (!ensureVapid()) return 0;

  let subscriptions;
  try {
    subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });
  } catch {
    return 0;
  }
  if (subscriptions.length === 0) return 0;

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? "/",
  });

  let delivered = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 },
        );
        delivered++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        } else {
          console.error(
            `[push] delivery failed (${statusCode ?? "network"}) for sub ${sub.id}`,
          );
        }
      }
    }),
  );
  return delivered;
}
