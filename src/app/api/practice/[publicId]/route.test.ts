import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { GET, OPTIONS } from "./route";

// Mock the DB so this stays a unit test and db.ts's module-level
// `new PrismaClient()` (Prisma 7 driver adapter) never runs under node env.
vi.mock("@/lib/db", () => ({
  prisma: { practice: { findFirst: vi.fn() } },
}));

const findFirst = vi.mocked(prisma.practice.findFirst);

function req() {
  return new Request("http://localhost/api/practice/khomas00001");
}

describe("GET /api/practice/[publicId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with the flat snake_case contract for an APPROVED practice", async () => {
    findFirst.mockResolvedValue({
      practiceName: "Sunrise Clinic",
      doctorName: "Dr. Jane Doe",
      specialty: "Cardiology",
      phone: "+264 61 123456",
      email: "info@sunrise.example",
      address: "1 Main St, Windhoek",
      hours: "Mon-Fri 08:00-17:00",
      logoUrl: "https://cdn.example/logo.png",
      photoUrl: "https://cdn.example/photo.jpg",
      about: "A friendly neighbourhood clinic.",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await GET(req(), {
      params: Promise.resolve({ publicId: "khomas00001" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      practice_name: "Sunrise Clinic",
      doctor_name: "Dr. Jane Doe",
      specialty: "Cardiology",
      phone: "+264 61 123456",
      email: "info@sunrise.example",
      address: "1 Main St, Windhoek",
      hours: "Mon-Fri 08:00-17:00",
      logo: "https://cdn.example/logo.png",
      photo: "https://cdn.example/photo.jpg",
      about: "A friendly neighbourhood clinic.",
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    // APPROVED-only filter
    expect(findFirst).toHaveBeenCalledWith({
      where: { publicId: "khomas00001", status: "APPROVED" },
    });
  });

  it("maps absent logoUrl/photoUrl to null (keys always present)", async () => {
    findFirst.mockResolvedValue({
      practiceName: "No Media Clinic",
      doctorName: "Dr. John Smith",
      specialty: "General Practice",
      phone: "+264 61 000000",
      email: "hello@nomedia.example",
      address: "2 Side St, Windhoek",
      hours: "Mon-Fri 09:00-16:00",
      logoUrl: null,
      photoUrl: null,
      about: "About text.",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await GET(req(), {
      params: Promise.resolve({ publicId: "khomas00002" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logo).toBeNull();
    expect(body.photo).toBeNull();
  });

  it("returns 404 when findFirst returns null (missing or not APPROVED)", async () => {
    findFirst.mockResolvedValue(null);

    const res = await GET(req(), {
      params: Promise.resolve({ publicId: "khomas99999" }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Practice not found" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it("returns 400 for an invalid id format and never hits the DB", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ publicId: "bad id!" }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid ID format" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("OPTIONS /api/practice/[publicId]", () => {
  it("returns 204 with the CORS preflight headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });
});
