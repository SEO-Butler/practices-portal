import { describe, it, expect, vi, afterEach } from "vitest";
import { RateLimiter } from "./rate-limit";

afterEach(() => vi.useRealTimers());

describe("RateLimiter", () => {
  it("allows up to max attempts then blocks", () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    const blocked = limiter.check("k");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(false);
    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(limiter.check("k").allowed).toBe(true);
  });

  it("reset() clears a key immediately", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.check("k");
    limiter.check("k");
    limiter.reset("k");
    expect(limiter.check("k").allowed).toBe(true);
  });
});
