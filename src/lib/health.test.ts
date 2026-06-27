import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "./db";
import { checkDatabase } from "./health";

vi.mock("./db", () => ({ prisma: { $queryRaw: vi.fn() } }));

describe("checkDatabase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when the query succeeds", async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ ok: 1 }]);
    expect(await checkDatabase()).toBe(true);
  });

  it("returns false when the query throws", async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("no db"));
    expect(await checkDatabase()).toBe(false);
  });
});
