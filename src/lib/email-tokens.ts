import { prisma } from "@/lib/db";
import { generateEmailToken, hashEmailToken } from "@/lib/auth";
import { notify } from "@/lib/notify";

const TTL_HOURS = { VERIFY: 24, RESET: 1 } as const;

/**
 * Issues a one-time VERIFY or RESET token for a user and emits the matching
 * notification event (webhook-delivered or simulated). Older unused tokens
 * of the same type are invalidated.
 */
export async function issueEmailToken(
  user: { id: string; email: string },
  type: "VERIFY" | "RESET",
  baseUrl: string,
): Promise<void> {
  const { raw, hash } = generateEmailToken();
  await prisma.emailToken.deleteMany({
    where: { userId: user.id, type, usedAt: null },
  });
  await prisma.emailToken.create({
    data: {
      userId: user.id,
      type,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + TTL_HOURS[type] * 60 * 60 * 1000),
    },
  });

  if (type === "VERIFY") {
    const link = `${baseUrl}/verify?token=${raw}`;
    await notify({
      userId: user.id,
      type: "EMAIL_VERIFY",
      channel: "EMAIL",
      recipient: user.email,
      title: "Verify your email address",
      body: `Welcome to Practices Portal. Confirm your email by opening: ${link} (valid for ${TTL_HOURS.VERIFY} hours).`,
      data: { link },
    });
  } else {
    const link = `${baseUrl}/reset-password?token=${raw}`;
    await notify({
      userId: user.id,
      type: "PASSWORD_RESET",
      channel: "EMAIL",
      recipient: user.email,
      title: "Reset your password",
      body: `Someone requested a password reset for your account. Open ${link} to set a new password (valid for ${TTL_HOURS.RESET} hour). Ignore this if it wasn't you.`,
      data: { link },
    });
  }
}

/** Looks up a live (unused, unexpired) token by its raw value. */
export async function consumeEmailToken(
  rawToken: string,
  type: "VERIFY" | "RESET",
) {
  const token = await prisma.emailToken.findUnique({
    where: { tokenHash: hashEmailToken(rawToken) },
    include: { user: true },
  });
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }
  return token;
}
