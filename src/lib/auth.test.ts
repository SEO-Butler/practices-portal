import { describe, it, expect, vi, afterEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  homePathFor,
  generateEmailToken,
  hashEmailToken,
} from "./auth";
import { signWebhookBody } from "./notify";

vi.mock("@/lib/db", () => ({ prisma: {} }));

afterEach(() => vi.useRealTimers());

describe("password hashing", () => {
  it("round-trips a correct password", () => {
    const stored = hashPassword("s3cret-pass");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("s3cret-pass", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("s3cret-pass");
    expect(verifyPassword("wrong-pass", stored)).toBe(false);
  });

  it("produces unique salts per hash", () => {
    expect(hashPassword("same")).not.toEqual(hashPassword("same"));
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
    expect(verifyPassword("x", "bcrypt$a$b$c$d$e")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken({ sub: "user1", role: "PATIENT", sid: "sess1" });
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user1");
    expect(payload!.role).toBe("PATIENT");
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken({ sub: "user1", role: "PATIENT", sid: "sess1" });
    const [body] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "user1", role: "DOCTOR", exp: 9999999999 }),
    ).toString("base64url");
    const [, sig] = token.split(".");
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${body}.AAAA`)).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken({ sub: "u", role: "NURSE", sid: "sess2" }, 60);
    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"));
    expect(verifySessionToken(token)).toBeNull();
  });
});

describe("email tokens", () => {
  it("stores only a hash that matches the raw token", () => {
    const { raw, hash } = generateEmailToken();
    expect(hash).toBe(hashEmailToken(raw));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(raw).not.toContain(hash);
    expect(generateEmailToken().hash).not.toBe(hash); // unique per call
  });
});

describe("webhook signature", () => {
  it("is a deterministic HMAC-SHA256 hex digest", () => {
    const sig = signWebhookBody('{"a":1}', "secret");
    expect(sig).toBe(signWebhookBody('{"a":1}', "secret"));
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signWebhookBody('{"a":2}', "secret")).not.toBe(sig);
    expect(signWebhookBody('{"a":1}', "other")).not.toBe(sig);
  });
});

describe("homePathFor", () => {
  it("maps each clinic role to its dashboard", () => {
    expect(homePathFor("PATIENT")).toBe("/patient");
    expect(homePathFor("RECEPTIONIST")).toBe("/reception");
    expect(homePathFor("NURSE")).toBe("/nurse");
    expect(homePathFor("DOCTOR")).toBe("/doctor");
    expect(homePathFor("MANAGER")).toBe("/manager");
    expect(homePathFor("ADMIN")).toBe("/");
  });
});
