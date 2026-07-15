import { describe, it, expect } from "vitest";
import { flagValue, worstFlag, normalBand } from "./vitals-flags";

describe("flagValue", () => {
  it("classifies blood pressure", () => {
    expect(flagValue("systolic", 120)).toEqual({ level: "normal", direction: null });
    expect(flagValue("systolic", 150)).toEqual({ level: "warn", direction: "high" });
    expect(flagValue("systolic", 185)).toEqual({ level: "critical", direction: "high" });
    expect(flagValue("systolic", 95)).toEqual({ level: "warn", direction: "low" });
    expect(flagValue("systolic", 85)).toEqual({ level: "critical", direction: "low" });
    expect(flagValue("diastolic", 98)).toEqual({ level: "warn", direction: "high" });
  });

  it("classifies boundary values as inside the band", () => {
    expect(flagValue("heartRate", 100).level).toBe("normal");
    expect(flagValue("heartRate", 101).level).toBe("warn");
    expect(flagValue("heartRate", 50).level).toBe("normal");
  });

  it("handles open-ended ranges (SpO2 has no high, pain no low)", () => {
    expect(flagValue("oxygenSat", 100).level).toBe("normal");
    expect(flagValue("oxygenSat", 92)).toEqual({ level: "warn", direction: "low" });
    expect(flagValue("oxygenSat", 85)).toEqual({ level: "critical", direction: "low" });
    expect(flagValue("painLevel", 0).level).toBe("normal");
    expect(flagValue("painLevel", 6)).toEqual({ level: "warn", direction: "high" });
    expect(flagValue("painLevel", 9)).toEqual({ level: "critical", direction: "high" });
  });

  it("ignores unknown keys", () => {
    expect(flagValue("weightKg", 500).level).toBe("normal");
  });
});

describe("worstFlag", () => {
  it("returns the most severe level present", () => {
    expect(worstFlag({ systolic: 120, heartRate: 80 })).toBe("normal");
    expect(worstFlag({ systolic: 150, heartRate: 80 })).toBe("warn");
    expect(worstFlag({ systolic: 150, oxygenSat: 85 })).toBe("critical");
    expect(worstFlag({ notes: "fine" })).toBe("normal");
  });
});

describe("normalBand", () => {
  it("exposes chartable normal ranges", () => {
    expect(normalBand("heartRate")).toEqual({ low: 50, high: 100 });
    expect(normalBand("oxygenSat")).toEqual({ low: 94, high: null });
    expect(normalBand("weightKg")).toBeNull();
  });
});
