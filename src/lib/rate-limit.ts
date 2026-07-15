// Fixed-window in-memory rate limiter. Single-instance by design (like the
// event bus); swap for Redis when scaling out. Pure class is unit-tested;
// shared limiter instances live on globalThis to survive dev hot-reload.

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Consumes one attempt. Disallowed once more than `max` land in a window. */
  check(key: string): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    // Opportunistic pruning keeps the map from growing unboundedly.
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
    }
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > this.max) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  /** Clears a key — e.g. successful login resets that account's failures. */
  reset(key: string): void {
    this.buckets.delete(key);
  }
}

const globalLimiters = globalThis as unknown as {
  ppLimiters?: Record<string, RateLimiter>;
};

function shared(name: string, max: number, windowMs: number): RateLimiter {
  const store = (globalLimiters.ppLimiters ??= {});
  return (store[name] ??= new RateLimiter(max, windowMs));
}

/** Failed sign-ins per account: 5 per 15 minutes. */
export const loginEmailLimiter = () => shared("loginEmail", 5, 15 * 60_000);
/** Sign-in attempts per IP: 20 per 15 minutes. */
export const loginIpLimiter = () => shared("loginIp", 20, 15 * 60_000);
/** Password-reset requests per IP: 5 per hour. */
export const forgotLimiter = () => shared("forgot", 5, 60 * 60_000);
/** Registrations per IP: 10 per hour. */
export const registerLimiter = () => shared("register", 10, 60 * 60_000);

export function tooManyRequests(retryAfterSec: number) {
  return new Response(
    JSON.stringify({ error: "Too many attempts. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}
