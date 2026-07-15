// Clinical reference ranges for flagging abnormal vitals (adult, at-rest).
// Pure module — unit-tested in vitals-flags.test.ts, shared by UI components.

export type FlagLevel = "normal" | "warn" | "critical";

export interface VitalsFlag {
  level: FlagLevel;
  direction: "high" | "low" | null;
}

interface Range {
  criticalLow?: number;
  warnLow?: number;
  warnHigh?: number;
  criticalHigh?: number;
}

export const VITAL_RANGES: Record<string, Range> = {
  systolic: { criticalLow: 90, warnLow: 100, warnHigh: 139, criticalHigh: 179 },
  diastolic: { criticalLow: 60, warnLow: 65, warnHigh: 89, criticalHigh: 119 },
  heartRate: { criticalLow: 40, warnLow: 50, warnHigh: 100, criticalHigh: 130 },
  respiratoryRate: { criticalLow: 8, warnLow: 12, warnHigh: 20, criticalHigh: 27 },
  temperatureC: { criticalLow: 35, warnLow: 36, warnHigh: 37.7, criticalHigh: 39.4 },
  oxygenSat: { criticalLow: 88, warnLow: 94 },
  glucoseMmol: { criticalLow: 3, warnLow: 4, warnHigh: 7.8, criticalHigh: 11 },
  painLevel: { warnHigh: 4, criticalHigh: 7 },
};

/** Normal band for chart shading; null when a bound is open-ended. */
export function normalBand(
  key: string,
): { low: number | null; high: number | null } | null {
  const r = VITAL_RANGES[key];
  if (!r) return null;
  return { low: r.warnLow ?? null, high: r.warnHigh ?? null };
}

export function flagValue(key: string, value: number): VitalsFlag {
  const r = VITAL_RANGES[key];
  if (!r) return { level: "normal", direction: null };
  if (r.criticalHigh !== undefined && value > r.criticalHigh) {
    return { level: "critical", direction: "high" };
  }
  if (r.criticalLow !== undefined && value < r.criticalLow) {
    return { level: "critical", direction: "low" };
  }
  if (r.warnHigh !== undefined && value > r.warnHigh) {
    return { level: "warn", direction: "high" };
  }
  if (r.warnLow !== undefined && value < r.warnLow) {
    return { level: "warn", direction: "low" };
  }
  return { level: "normal", direction: null };
}

/** Worst flag level across all present numeric vitals in a record. */
export function worstFlag(
  record: Record<string, unknown>,
): FlagLevel {
  let worst: FlagLevel = "normal";
  for (const key of Object.keys(VITAL_RANGES)) {
    const value = record[key];
    if (typeof value !== "number") continue;
    const { level } = flagValue(key, value);
    if (level === "critical") return "critical";
    if (level === "warn") worst = "warn";
  }
  return worst;
}
