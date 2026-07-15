import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
  createHash,
} from "crypto";

// Pure-node auth primitives (no Next.js imports) so they stay unit-testable
// under the vitest node environment. Cookie plumbing lives in session.ts.

export type SessionRole =
  | "OWNER"
  | "ADMIN"
  | "PATIENT"
  | "MANAGER"
  | "RECEPTIONIST"
  | "NURSE"
  | "DOCTOR";

export interface SessionPayload {
  sub: string; // user id
  role: SessionRole;
  sid: string; // server-side Session row id — enables revocation
  exp: number; // unix seconds
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

function secret(): string {
  // AUTH_SECRET must be set in production (Coolify env); the fallback keeps
  // dev and CI working without extra setup.
  return process.env.AUTH_SECRET ?? "dev-only-insecure-secret";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  ttlSeconds = 60 * 60 * 24 * 7,
): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "pp_session";

/**
 * One-time email tokens (verify / password reset). Only the SHA-256 hash is
 * stored; the raw token goes into the emailed link.
 */
export function generateEmailToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashEmailToken(raw) };
}

export function hashEmailToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const STAFF_ROLES: SessionRole[] = [
  "MANAGER",
  "RECEPTIONIST",
  "NURSE",
  "DOCTOR",
];

/** Where a user lands after login, by role. */
export function homePathFor(role: SessionRole): string {
  switch (role) {
    case "PATIENT":
      return "/patient";
    case "RECEPTIONIST":
      return "/reception";
    case "NURSE":
      return "/nurse";
    case "DOCTOR":
      return "/doctor";
    case "MANAGER":
      return "/manager";
    default:
      return "/";
  }
}
