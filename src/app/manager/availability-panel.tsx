"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { minutesToTime } from "@/lib/slots";

interface Rule {
  id: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  doctor: { id: string; title: string | null; firstName: string; lastName: string };
}

interface DoctorOption {
  id: string;
  name: string;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-teal-500 focus:outline-none";

export function AvailabilityPanel({ doctors }: { doctors: DoctorOption[] }) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ rules: Rule[] }>("/api/manager/availability")
      .then((res) => setRules(res.rules))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await api("/api/manager/availability", {
        method: "POST",
        json: {
          doctorId: data.get("doctorId"),
          weekday: Number(data.get("weekday")),
          startTime: data.get("startTime"),
          endTime: data.get("endTime"),
          slotMinutes: Number(data.get("slotMinutes")),
        },
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add rule");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/manager/availability/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 font-semibold">Bookable hours</h2>
      <p className="mb-4 text-sm text-slate-500">
        Patients can only book into slots generated from these weekly rules —
        online double-booking is prevented automatically.
      </p>

      {doctors.length === 0 ? (
        <p className="text-sm text-slate-500">
          Add a doctor to the team first, then define their hours here.
        </p>
      ) : (
        <form onSubmit={onAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <label className="col-span-2 block text-sm">
            <span className="mb-1 block text-slate-600">Doctor</span>
            <select name="doctorId" required className={input}>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Day</span>
            <select name="weekday" required className={input} defaultValue="1">
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">From</span>
            <input name="startTime" type="time" defaultValue="08:00" required className={input} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">To</span>
            <input name="endTime" type="time" defaultValue="17:00" required className={input} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Slot (min)</span>
            <select name="slotMinutes" className={input} defaultValue="30">
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 sm:col-span-6">
            <button
              disabled={busy}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add hours"}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-5">
        {rules === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-slate-500">
            No bookable hours defined yet — patients can&apos;t book online
            until you add some.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">
                    {r.doctor.title ? `${r.doctor.title} ` : ""}
                    {r.doctor.firstName} {r.doctor.lastName}
                  </span>{" "}
                  · {WEEKDAYS[r.weekday]} {minutesToTime(r.startMinute)}–
                  {minutesToTime(r.endMinute)} ({r.slotMinutes} min slots)
                </span>
                <button
                  onClick={() => remove(r.id)}
                  className="text-xs text-rose-600 underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
