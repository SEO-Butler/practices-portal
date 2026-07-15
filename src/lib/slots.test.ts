import { describe, it, expect } from "vitest";
import {
  slotsForDay,
  resolveBooking,
  parseTimeToMinutes,
  minutesToTime,
} from "./slots";

// 2026-07-20 is a Monday (weekday 1).
const MONDAY = new Date("2026-07-20T00:00:00");
const EARLY = new Date("2026-07-19T06:00:00"); // "now" well before the day

const drA = {
  doctorId: "drA",
  weekday: 1,
  startMinute: 8 * 60,
  endMinute: 10 * 60,
  slotMinutes: 30,
};
const drB = {
  doctorId: "drB",
  weekday: 1,
  startMinute: 9 * 60,
  endMinute: 10 * 60,
  slotMinutes: 30,
};

function at(hhmm: string): Date {
  return new Date(`2026-07-20T${hhmm}:00`);
}

describe("slotsForDay", () => {
  it("generates slots from rules for the matching weekday only", () => {
    const slots = slotsForDay([drA], MONDAY, [], EARLY);
    expect(slots.map((s) => s.time.getHours() * 60 + s.time.getMinutes())).toEqual([
      480, 510, 540, 570,
    ]);
    // Tuesday has no rules
    expect(slotsForDay([drA], new Date("2026-07-21T00:00:00"), [], EARLY)).toEqual([]);
  });

  it("merges doctors offering the same time", () => {
    const slots = slotsForDay([drA, drB], MONDAY, [], EARLY);
    const nine = slots.find((s) => s.time.getTime() === at("09:00").getTime());
    expect(nine?.doctorIds.sort()).toEqual(["drA", "drB"]);
    const eight = slots.find((s) => s.time.getTime() === at("08:00").getTime());
    expect(eight?.doctorIds).toEqual(["drA"]);
  });

  it("excludes booked times per doctor", () => {
    const busy = [{ doctorId: "drA", scheduledAt: at("09:00") }];
    const slots = slotsForDay([drA, drB], MONDAY, busy, EARLY);
    const nine = slots.find((s) => s.time.getTime() === at("09:00").getTime());
    expect(nine?.doctorIds).toEqual(["drB"]);
    // fully booked slot disappears
    const busyBoth = [
      { doctorId: "drA", scheduledAt: at("09:30") },
      { doctorId: "drB", scheduledAt: at("09:30") },
    ];
    const slots2 = slotsForDay([drA, drB], MONDAY, busyBoth, EARLY);
    expect(slots2.some((s) => s.time.getTime() === at("09:30").getTime())).toBe(false);
  });

  it("excludes past times", () => {
    const slots = slotsForDay([drA], MONDAY, [], at("08:45"));
    expect(slots.map((s) => s.time.getTime())).toEqual([
      at("09:00").getTime(),
      at("09:30").getTime(),
    ]);
  });

  it("does not emit a slot that would overrun the window", () => {
    const rule = { ...drA, startMinute: 8 * 60, endMinute: 8 * 60 + 45 };
    const slots = slotsForDay([rule], MONDAY, [], EARLY);
    expect(slots).toHaveLength(1); // only 08:00 fits a 30-min slot in 45 min
  });
});

describe("resolveBooking", () => {
  it("accepts a valid slot with the requested doctor", () => {
    const res = resolveBooking([drA, drB], "drB", at("09:00"), [], EARLY);
    expect(res).toEqual({ ok: true, doctorId: "drB" });
  });

  it("auto-assigns a free doctor when none requested", () => {
    const busy = [{ doctorId: "drA", scheduledAt: at("09:00") }];
    const res = resolveBooking([drA, drB], null, at("09:00"), busy, EARLY);
    expect(res).toEqual({ ok: true, doctorId: "drB" });
  });

  it("rejects off-grid times and double bookings", () => {
    expect(resolveBooking([drA], "drA", at("08:15"), [], EARLY).ok).toBe(false);
    const busy = [{ doctorId: "drA", scheduledAt: at("08:00") }];
    expect(resolveBooking([drA], "drA", at("08:00"), busy, EARLY).ok).toBe(false);
    expect(resolveBooking([drA], null, at("08:00"), busy, EARLY).ok).toBe(false);
  });

  it("rejects a doctor with no rule at that time", () => {
    expect(resolveBooking([drA, drB], "drB", at("08:00"), [], EARLY).ok).toBe(false);
  });
});

describe("time helpers", () => {
  it("parses and formats HH:MM", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("8:05")).toBe(485);
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("nope")).toBeNull();
    expect(parseTimeToMinutes(830)).toBeNull();
    expect(minutesToTime(510)).toBe("08:30");
  });
});
