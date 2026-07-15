"use client";

import { useEffect, useRef, useState } from "react";
import { api, fmtTime } from "@/lib/client";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dateOfBirth: string | null;
  medicalAidName: string | null;
  email: string | null;
}

interface Slot {
  time: string;
  doctorIds: string[];
}

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-teal-500 focus:outline-none";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PatientsClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [practiceId, setPracticeId] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Booking panel state
  const [mode, setMode] = useState<"walk_in" | "scheduled">("walk_in");
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function search(q: string) {
    setQuery(q);
    setMessage(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    debounce.current = setTimeout(() => {
      setSearching(true);
      api<{ patients: Patient[]; practiceId: string }>(
        `/api/staff/patients?q=${encodeURIComponent(q.trim())}`,
      )
        .then((res) => {
          setResults(res.patients);
          setPracticeId(res.practiceId);
        })
        .catch((err) => setError(err.message))
        .finally(() => setSearching(false));
    }, 300);
  }

  function loadSlots(d: string) {
    if (!practiceId) return;
    setSlots(null);
    setSelectedSlot(null);
    api<{ slots: Slot[] }>(
      `/api/slots?practiceId=${encodeURIComponent(practiceId)}&date=${d}`,
    )
      .then((res) => setSlots(res.slots))
      .catch(() => setSlots([]));
  }

  // practiceId arrives with the first search; needed before slots load.
  useEffect(() => {
    if (!practiceId) {
      api<{ practiceId: string }>("/api/staff/patients?q=").then((res) =>
        setPracticeId(res.practiceId),
      );
    }
  }, [practiceId]);

  async function onRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await api<{ patient: Patient; invited: boolean }>(
        "/api/staff/patients",
        {
          method: "POST",
          json: {
            firstName: data.get("firstName"),
            lastName: data.get("lastName"),
            phone: data.get("phone"),
            email: data.get("email"),
            dateOfBirth: data.get("dateOfBirth"),
          },
        },
      );
      setSelected(res.patient);
      setShowRegister(false);
      setMessage(
        res.invited
          ? `${res.patient.firstName} registered — an account-claim link was sent to their email.`
          : `${res.patient.firstName} registered (no email — offline patient).`,
      );
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function onBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    if (mode === "scheduled" && !selectedSlot) {
      setError("Pick a time slot");
      return;
    }
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await api<{ appointment: { queueNumber: number | null } }>(
        "/api/staff/appointments",
        {
          method: "POST",
          json: {
            patientId: selected.id,
            mode,
            reason: data.get("reason"),
            ...(mode === "scheduled" ? { scheduledAt: selectedSlot } : {}),
          },
        },
      );
      setMessage(
        mode === "walk_in"
          ? `${selected.firstName} checked in — queue number ${res.appointment.queueNumber}.`
          : `Appointment booked and confirmed for ${selected.firstName}.`,
      );
      setSelected(null);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold">Find a patient</h2>
          <p className="mb-3 text-sm text-slate-500">
            Search by name, phone number or email.
          </p>
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="e.g. Mbeki or 081…"
            className={input}
          />
          {searching && <p className="mt-2 text-sm text-slate-400">Searching…</p>}
          {results !== null && !searching && (
            <ul className="mt-3 divide-y divide-slate-100">
              {results.length === 0 && (
                <li className="py-3 text-sm text-slate-500">
                  No patients found.{" "}
                  <button
                    onClick={() => setShowRegister(true)}
                    className="text-teal-700 underline"
                  >
                    Register a new walk-in
                  </button>
                </li>
              )}
              {results.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {[
                        p.phone,
                        p.email,
                        p.dateOfBirth
                          ? `born ${new Date(p.dateOfBirth).toLocaleDateString()}`
                          : null,
                        p.medicalAidName,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelected(p);
                      setMessage(null);
                      setMode("walk_in");
                    }}
                    className="shrink-0 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Check in / book
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setShowRegister((s) => !s)}
            className="mt-4 text-sm font-medium text-teal-700 underline"
          >
            {showRegister ? "Hide new-patient form" : "New walk-in patient"}
          </button>
        </div>

        {showRegister && (
          <form
            onSubmit={onRegister}
            className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-3 font-semibold">Register walk-in patient</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">First name</span>
                <input name="firstName" required className={input} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Last name</span>
                <input name="lastName" required className={input} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Phone</span>
                <input name="phone" type="tel" className={input} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Date of birth</span>
                <input name="dateOfBirth" type="date" className={input} />
              </label>
              <label className="col-span-2 block text-sm">
                <span className="mb-1 block text-slate-600">
                  Email (optional — sends an account-claim link)
                </span>
                <input name="email" type="email" className={input} />
              </label>
            </div>
            <button
              disabled={busy}
              className="mt-4 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? "Registering…" : "Register patient"}
            </button>
          </form>
        )}
      </section>

      <section>
        {message && (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
        {!selected ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
            Select a patient to check them in or book an appointment.
          </div>
        ) : (
          <form
            onSubmit={onBook}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-3 font-semibold">
              {selected.firstName} {selected.lastName}
            </h2>
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("walk_in")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === "walk_in"
                    ? "bg-teal-600 text-white"
                    : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Walk-in (check in now)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("scheduled");
                  loadSlots(date);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === "scheduled"
                    ? "bg-teal-600 text-white"
                    : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Schedule appointment
              </button>
            </div>

            {mode === "scheduled" && (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-600">Date</span>
                  <input
                    type="date"
                    value={date}
                    min={todayStr()}
                    onChange={(e) => {
                      setDate(e.target.value);
                      loadSlots(e.target.value);
                    }}
                    className={input}
                  />
                </label>
                <div className="mt-3 text-sm">
                  <span className="mb-1 block text-slate-600">Available times</span>
                  {slots === null ? (
                    <p className="text-slate-400">Loading slots…</p>
                  ) : slots.length === 0 ? (
                    <p className="rounded-md bg-slate-50 p-3 text-slate-500">
                      No open slots on this day.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((s) => (
                        <button
                          key={s.time}
                          type="button"
                          onClick={() => setSelectedSlot(s.time)}
                          className={`rounded-md border px-3 py-1.5 font-medium transition ${
                            selectedSlot === s.time
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:border-teal-400"
                          }`}
                        >
                          {fmtTime(s.time)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-slate-600">Reason for visit</span>
              <textarea name="reason" rows={2} required className={input} />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                disabled={busy || (mode === "scheduled" && !selectedSlot)}
                className="rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {busy
                  ? "Working…"
                  : mode === "walk_in"
                    ? "Check in now"
                    : "Book & confirm"}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
