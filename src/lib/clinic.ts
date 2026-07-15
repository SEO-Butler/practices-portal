import type { SessionRole } from "@/lib/auth";

// Pure clinic domain rules (no Next/Prisma imports) — unit-tested in
// clinic.test.ts and shared by route handlers and UI.

export type AppointmentStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_CONSULT"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AppointmentAction =
  | "confirm"
  | "check_in"
  | "start_consult"
  | "complete"
  | "cancel"
  | "no_show";

/** Valid source statuses for each action. */
const ACTION_FROM: Record<AppointmentAction, AppointmentStatus[]> = {
  confirm: ["REQUESTED"],
  check_in: ["REQUESTED", "CONFIRMED"],
  start_consult: ["CHECKED_IN"],
  complete: ["IN_CONSULT"],
  cancel: ["REQUESTED", "CONFIRMED"],
  no_show: ["REQUESTED", "CONFIRMED"],
};

export const ACTION_TO: Record<AppointmentAction, AppointmentStatus> = {
  confirm: "CONFIRMED",
  check_in: "CHECKED_IN",
  start_consult: "IN_CONSULT",
  complete: "COMPLETED",
  cancel: "CANCELLED",
  no_show: "NO_SHOW",
};

/** Which staff roles may perform each action. */
const ACTION_ROLES: Record<AppointmentAction, SessionRole[]> = {
  confirm: ["RECEPTIONIST", "MANAGER"],
  check_in: ["RECEPTIONIST", "MANAGER", "NURSE"],
  start_consult: ["DOCTOR", "MANAGER"],
  complete: ["DOCTOR", "MANAGER"],
  cancel: ["RECEPTIONIST", "MANAGER"],
  no_show: ["RECEPTIONIST", "MANAGER"],
};

export function isAppointmentAction(v: string): v is AppointmentAction {
  return v in ACTION_TO;
}

export function canPerformAction(
  role: SessionRole,
  action: AppointmentAction,
): boolean {
  return ACTION_ROLES[action].includes(role);
}

export function canTransition(
  from: AppointmentStatus,
  action: AppointmentAction,
): boolean {
  return ACTION_FROM[action].includes(from);
}

/** Anonymized display name for the public waiting-room board. */
export function initialsOf(firstName: string, lastName: string): string {
  const f = firstName.trim().charAt(0).toUpperCase();
  const l = lastName.trim().charAt(0).toUpperCase();
  return `${f || "?"}. ${l || "?"}.`;
}

export interface VitalsInput {
  systolic?: number | null;
  diastolic?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  temperatureC?: number | null;
  oxygenSat?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  glucoseMmol?: number | null;
  painLevel?: number | null;
  notes?: string | null;
}

const VITAL_RANGES: Record<
  Exclude<keyof VitalsInput, "notes">,
  [number, number]
> = {
  systolic: [50, 300],
  diastolic: [30, 200],
  heartRate: [20, 300],
  respiratoryRate: [4, 80],
  temperatureC: [25, 45],
  oxygenSat: [40, 100],
  weightKg: [1, 500],
  heightCm: [30, 260],
  glucoseMmol: [1, 50],
  painLevel: [0, 10],
};

/**
 * Validates and normalizes a vitals payload. Unknown keys are dropped,
 * empty strings become null, out-of-range values are errors.
 */
export function parseVitals(
  raw: Record<string, unknown>,
): { ok: true; vitals: VitalsInput } | { ok: false; error: string } {
  const vitals: VitalsInput = {};
  let hasValue = false;

  for (const key of Object.keys(VITAL_RANGES) as Array<
    Exclude<keyof VitalsInput, "notes">
  >) {
    const value = raw[key];
    if (value === undefined || value === null || value === "") continue;
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) {
      return { ok: false, error: `${key} must be a number` };
    }
    const [min, max] = VITAL_RANGES[key];
    if (num < min || num > max) {
      return { ok: false, error: `${key} must be between ${min} and ${max}` };
    }
    vitals[key] = num;
    hasValue = true;
  }

  if (typeof raw.notes === "string" && raw.notes.trim()) {
    vitals.notes = raw.notes.trim().slice(0, 2000);
    hasValue = true;
  }

  if (!hasValue) {
    return { ok: false, error: "At least one vital sign is required" };
  }
  return { ok: true, vitals };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 8;
}
