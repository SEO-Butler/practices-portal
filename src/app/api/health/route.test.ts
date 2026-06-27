import { describe, it, expect, vi, beforeEach } from "vitest";
import * as health from "@/lib/health";
import { GET } from "./route";

// Isolate the unit: prevent db.ts's module-level `new PrismaClient()` from
// running under the node test env (Prisma 7 requires a driver adapter at
// construction, which is irrelevant here since checkDatabase is spied below).
// Mirrors the existing convention in src/lib/health.test.ts.
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: vi.fn() } }));

describe("GET /api/health", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns 200 and status ok when the DB is up", async () => {
    vi.spyOn(health, "checkDatabase").mockResolvedValue(true);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "up" });
  });

  it("returns 503 and status degraded when the DB is down", async () => {
    vi.spyOn(health, "checkDatabase").mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded", db: "down" });
  });
});
