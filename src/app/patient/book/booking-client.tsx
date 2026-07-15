"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";
import { StatusBadge } from "@/components/status-badge";

interface Doctor {
  id: string;
  name: string;
  specialty: string | null;
}
interface Practice {
  id: string;
  name: string;
  address: string | null;
  doctors: Doctor[];
}
interface Appointment {
  id: string;
  scheduledAt: string;
  reason: string;
  status: string;
  practice: { practiceName: string | null };
  doctor: { title: string | null; firstName: string; lastName: string } | null;
}

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-teal-500 focus:outline-none";

export function BookingClient() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceId, setPracticeId] = useState("");
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAppointments = useCallback(() => {
    api<{ appointments: Appointment[] }>("/api/patient/appointments")
      .then((res) => setAppointments(res.appointments))
      .catch(() => setAppointments([]));
  }, []);

  useEffect(() => {
    api<{ practices: Practice[] }>("/api/practices")
      .then((res) => {
        setPractices(res.practices);
        if (res.practices.length > 0) setPracticeId(res.practices[0].id);
      })
      .catch(() => setError("Could not load practices"));
    loadAppointments();
  }, [loadAppointments]);

  const selected = practices.find((p) => p.id === practiceId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await api("/api/patient/appointments", {
        method: "POST",
        json: {
          practiceId,
          doctorId: data.get("doctorId") || null,
          scheduledAt: new Date(String(data.get("scheduledAt"))).toISOString(),
          reason: data.get("reason"),
        },
      });
      setMessage(
        "Booking requested. The practice will confirm your appointment.",
      );
      form.reset();
      loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    try {
      await api(`/api/patient/appointments/${id}`, {
        method: "PATCH",
        json: { action: "cancel" },
      });
      loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 font-semibold">New booking</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Practice</span>
          <select
            value={practiceId}
            onChange={(e) => setPracticeId(e.target.value)}
            required
            className={input}
          >
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.address ? ` — ${p.address}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-slate-600">Doctor (optional)</span>
          <select name="doctorId" className={input} defaultValue="">
            <option value="">Any available doctor</option>
            {selected?.doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.specialty ? ` — ${d.specialty}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-slate-600">Date and time</span>
          <input
            name="scheduledAt"
            type="datetime-local"
            required
            className={input}
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-slate-600">Reason for visit</span>
          <textarea name="reason" rows={3} required className={input} />
        </label>
        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button
          disabled={busy || !practiceId}
          className="mt-5 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Requesting…" : "Request booking"}
        </button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">My appointments</h2>
        {appointments === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-slate-500">No appointments yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {appointments.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{fmtDateTime(a.scheduledAt)}</p>
                  <p className="truncate text-sm text-slate-500">
                    {a.practice.practiceName ?? "Practice"}
                    {a.doctor
                      ? ` · ${a.doctor.title ? a.doctor.title + " " : ""}${a.doctor.firstName} ${a.doctor.lastName}`
                      : ""}
                  </p>
                  <p className="truncate text-sm text-slate-400">{a.reason}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={a.status} />
                  {["REQUESTED", "CONFIRMED"].includes(a.status) && (
                    <button
                      onClick={() => cancel(a.id)}
                      className="text-xs text-rose-600 underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
