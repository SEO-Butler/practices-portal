import { describe, it, expect } from "vitest";
import {
  canPerformAction,
  canTransition,
  initialsOf,
  isAppointmentAction,
  parseVitals,
  ACTION_TO,
} from "./clinic";

describe("appointment transitions", () => {
  it("maps actions to target statuses", () => {
    expect(ACTION_TO.check_in).toBe("CHECKED_IN");
    expect(ACTION_TO.complete).toBe("COMPLETED");
  });

  it("allows valid transitions only", () => {
    expect(canTransition("REQUESTED", "confirm")).toBe(true);
    expect(canTransition("CONFIRMED", "check_in")).toBe(true);
    expect(canTransition("CHECKED_IN", "start_consult")).toBe(true);
    expect(canTransition("IN_CONSULT", "complete")).toBe(true);
    // invalid paths
    expect(canTransition("COMPLETED", "check_in")).toBe(false);
    expect(canTransition("CANCELLED", "confirm")).toBe(false);
    expect(canTransition("CHECKED_IN", "cancel")).toBe(false);
    expect(canTransition("REQUESTED", "complete")).toBe(false);
  });

  it("enforces role rights per action", () => {
    expect(canPerformAction("RECEPTIONIST", "confirm")).toBe(true);
    expect(canPerformAction("RECEPTIONIST", "complete")).toBe(false);
    expect(canPerformAction("DOCTOR", "start_consult")).toBe(true);
    expect(canPerformAction("DOCTOR", "cancel")).toBe(false);
    expect(canPerformAction("NURSE", "check_in")).toBe(true);
    expect(canPerformAction("NURSE", "complete")).toBe(false);
    expect(canPerformAction("MANAGER", "cancel")).toBe(true);
    expect(canPerformAction("PATIENT", "confirm")).toBe(false);
  });

  it("recognizes action names", () => {
    expect(isAppointmentAction("check_in")).toBe(true);
    expect(isAppointmentAction("delete")).toBe(false);
  });
});

describe("initialsOf", () => {
  it("builds anonymized initials", () => {
    expect(initialsOf("Jane", "Doe")).toBe("J. D.");
    expect(initialsOf("  amos", "van wyk")).toBe("A. V.");
    expect(initialsOf("", "")).toBe("?. ?.");
  });
});

describe("parseVitals", () => {
  it("accepts a normal self-capture payload", () => {
    const res = parseVitals({
      systolic: 120,
      diastolic: "80",
      heartRate: 72,
      notes: "  feeling dizzy  ",
    });
    expect(res).toEqual({
      ok: true,
      vitals: {
        systolic: 120,
        diastolic: 80,
        heartRate: 72,
        notes: "feeling dizzy",
      },
    });
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(parseVitals({ systolic: 900 }).ok).toBe(false);
    expect(parseVitals({ heartRate: "abc" }).ok).toBe(false);
    expect(parseVitals({ painLevel: 11 }).ok).toBe(false);
  });

  it("requires at least one value and drops empties/unknowns", () => {
    expect(parseVitals({}).ok).toBe(false);
    expect(parseVitals({ systolic: "", hacker: 1 }).ok).toBe(false);
    const res = parseVitals({ oxygenSat: 98, hacker: "x" });
    expect(res).toEqual({ ok: true, vitals: { oxygenSat: 98 } });
  });
});
