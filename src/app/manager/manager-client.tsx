"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Stats {
  today: Record<string, number>;
  weekTotal: number;
  pendingRequests: number;
  staffCount: number;
  waitingNow: number;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  specialty: string | null;
  user: { email: string; role: string };
}

const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none";

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Practice manager",
  RECEPTIONIST: "Receptionist",
  NURSE: "Nurse",
  DOCTOR: "Doctor",
};

export function ManagerClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Stats>("/api/manager/stats")
      .then(setStats)
      .catch((err) => setError(err.message));
    api<{ staff: StaffMember[] }>("/api/manager/staff")
      .then((res) => setStaff(res.staff))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  async function onAddStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await api("/api/manager/staff", {
        method: "POST",
        json: {
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          password: data.get("password"),
          role: data.get("role"),
          title: data.get("title"),
          specialty: data.get("specialty"),
        },
      });
      setMessage("Staff account created.");
      form.reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  const statCards = stats
    ? [
        { label: "Waiting now", value: stats.waitingNow },
        { label: "Open booking requests", value: stats.pendingRequests },
        {
          label: "Seen today",
          value: stats.today.COMPLETED ?? 0,
        },
        { label: "Appointments this week", value: stats.weekTotal },
        { label: "Staff members", value: stats.staffCount },
      ]
    : [];

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-3xl font-bold text-teal-700">{card.value}</p>
            <p className="mt-1 text-sm text-slate-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Team</h2>
          {staff === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : staff.length === 0 ? (
            <p className="text-sm text-slate-500">No staff yet — add your team.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {s.title ? `${s.title} ` : ""}
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {s.user.email}
                      {s.specialty ? ` · ${s.specialty}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {ROLE_LABEL[s.user.role] ?? s.user.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          onSubmit={onAddStaff}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 font-semibold">Add staff member</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">First name</span>
              <input name="firstName" required className={input} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Last name</span>
              <input name="lastName" required className={input} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Role</span>
              <select name="role" required className={input} defaultValue="RECEPTIONIST">
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="NURSE">Nurse</option>
                <option value="DOCTOR">Doctor</option>
                <option value="MANAGER">Practice manager</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Title (e.g. Dr, Sr)</span>
              <input name="title" className={input} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">Specialty (doctors)</span>
              <input name="specialty" className={input} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">Email</span>
              <input name="email" type="email" required className={input} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">
                Temporary password (min. 8 characters)
              </span>
              <input name="password" type="text" required minLength={8} className={input} />
            </label>
          </div>
          {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
          <button
            disabled={busy}
            className="mt-4 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
