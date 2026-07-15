"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime, fmtTime } from "@/lib/client";
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
interface Slot {
  time: string;
  doctorIds: string[];
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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BookingClient() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceId, setPracticeId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAppointments = useCallback(() => {
    api<{ appointments: Appointment[] }>("/api/patient/appointments")
      .then((res) => setAppointments(res.appointments))
      .catch(() => setAppointments([]));
  }, []);

  // Fetches open slots; called from change handlers and after initial load
  // (never synchronously inside an effect — see react-hooks/set-state-in-effect).
  const loadSlots = useCallback((pid: string, did: string, d: string) => {
    if (!pid || !d) return;
    setSlots(null);
    setSelectedSlot(null);
    const qs = new URLSearchParams({ practiceId: pid, date: d });
    if (did) qs.set("doctorId", did);
    api<{ slots: Slot[] }>(`/api/slots?${qs}`)
      .then((res) => setSlots(res.slots))
      .catch(() => setSlots([]));
  }, []);

  useEffect(() => {
    api<{ practices: Practice[] }>("/api/practices")
      .then((res) => {
        setPractices(res.practices);
        if (res.practices.length > 0) {
          setPracticeId(res.practices[0].id);
          loadSlots(res.practices[0].id, "", todayStr());
        }
      })
      .catch(() => setError("Could not load practices"));
    loadAppointments();
  }, [loadAppointments, loadSlots]);

  const selected = practices.find((p) => p.id === practiceId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot) {
      setError("Please pick a time slot");
      return;
    }
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
          doctorId: doctorId || null,
          scheduledAt: selectedSlot,
          reason: data.get("reason"),
        },
      });
      setMessage(
        "Booking requested. The practice will confirm your appointment — you'll get a notification.",
      );
      form.reset();
      setSelectedSlot(null);
      loadAppointments();
      // Refresh slots so the taken one disappears.
      loadSlots(practiceId, doctorId, date);
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
            onChange={(e) => {
              setPracticeId(e.target.value);
              setDoctorId("");
              loadSlots(e.target.value, "", date);
            }}
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
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Doctor (optional)</span>
            <select
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                loadSlots(practiceId, e.target.value, date);
              }}
              className={input}
            >
              <option value="">Any available doctor</option>
              {selected?.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Date</span>
            <input
              type="date"
              value={date}
              min={todayStr()}
              onChange={(e) => {
                setDate(e.target.value);
                loadSlots(practiceId, doctorId, e.target.value);
              }}
              required
              className={input}
            />
          </label>
        </div>

        <div className="mt-4 text-sm">
          <span className="mb-1 block text-slate-600">Available times</span>
          {slots === null ? (
            <p className="text-slate-400">Loading slots…</p>
          ) : slots.length === 0 ? (
            <p className="rounded-md bg-slate-50 p-3 text-slate-500">
              No open slots on this day — try another date
              {doctorId ? " or a different doctor" : ""}.
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

        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-slate-600">Reason for visit</span>
          <textarea name="reason" rows={3} required className={input} />
        </label>
        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button
          disabled={busy || !practiceId || !selectedSlot}
          className="mt-5 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy
            ? "Requesting…"
            : selectedSlot
              ? `Request ${fmtTime(selectedSlot)} slot`
              : "Pick a time slot"}
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
