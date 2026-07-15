// Pure slot-generation logic (no Prisma/Next imports) — unit-tested in
// slots.test.ts. Times are practice-local (= server-local for now).

export interface AvailabilityRuleInput {
  doctorId: string;
  weekday: number; // 0 = Sunday … 6 = Saturday
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
}

export interface BusyEntry {
  doctorId: string | null;
  scheduledAt: Date;
}

export interface Slot {
  time: Date;
  doctorIds: string[]; // doctors free at this time
}

/** Appointment statuses that occupy a slot. */
export const ACTIVE_APPOINTMENT_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_CONSULT",
] as const;

function isBusy(busy: BusyEntry[], doctorId: string, time: Date): boolean {
  return busy.some(
    (b) => b.doctorId === doctorId && b.scheduledAt.getTime() === time.getTime(),
  );
}

/**
 * Generates available slots for one calendar day from weekly rules,
 * excluding times already taken (per doctor) and times not after `now`.
 * `day` is any Date within the target day (local time).
 */
export function slotsForDay(
  rules: AvailabilityRuleInput[],
  day: Date,
  busy: BusyEntry[],
  now: Date,
): Slot[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const weekday = dayStart.getDay();

  const byTime = new Map<number, Set<string>>();
  for (const rule of rules) {
    if (rule.weekday !== weekday || rule.slotMinutes <= 0) continue;
    for (
      let m = rule.startMinute;
      m + rule.slotMinutes <= rule.endMinute;
      m += rule.slotMinutes
    ) {
      const time = new Date(dayStart.getTime() + m * 60_000);
      if (time.getTime() <= now.getTime()) continue;
      if (isBusy(busy, rule.doctorId, time)) continue;
      const key = time.getTime();
      if (!byTime.has(key)) byTime.set(key, new Set());
      byTime.get(key)!.add(rule.doctorId);
    }
  }

  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, doctors]) => ({ time: new Date(ts), doctorIds: [...doctors] }));
}

/**
 * Validates a requested booking time against the rules and picks the doctor:
 * the requested one if free, otherwise (when none requested) any free doctor
 * offering a slot at exactly that time.
 */
export function resolveBooking(
  rules: AvailabilityRuleInput[],
  requestedDoctorId: string | null,
  scheduledAt: Date,
  busy: BusyEntry[],
  now: Date,
): { ok: true; doctorId: string } | { ok: false; error: string } {
  const slots = slotsForDay(rules, scheduledAt, busy, now);
  const slot = slots.find((s) => s.time.getTime() === scheduledAt.getTime());
  if (!slot) {
    return {
      ok: false,
      error: "That time is not an available slot. Please pick another time.",
    };
  }
  if (requestedDoctorId) {
    if (!slot.doctorIds.includes(requestedDoctorId)) {
      return {
        ok: false,
        error: "The selected doctor is not available at that time.",
      };
    }
    return { ok: true, doctorId: requestedDoctorId };
  }
  return { ok: true, doctorId: slot.doctorIds[0] };
}

/** Parses "HH:MM" into minutes since midnight; null when malformed. */
export function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
