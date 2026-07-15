"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtTime } from "@/lib/client";
import { StatusBadge } from "@/components/status-badge";

interface StaffAppointment {
  id: string;
  scheduledAt: string;
  reason: string;
  status: string;
  queueNumber: number | null;
  patient: { firstName: string; lastName: string; phone: string | null };
  doctor: {
    title: string | null;
    firstName: string;
    lastName: string;
  } | null;
}

const ACTION_LABEL: Record<string, string> = {
  confirm: "Confirm",
  check_in: "Check in",
  cancel: "Cancel",
  no_show: "No show",
};

function actionsFor(status: string): string[] {
  switch (status) {
    case "REQUESTED":
      return ["confirm", "check_in", "cancel", "no_show"];
    case "CONFIRMED":
      return ["check_in", "cancel", "no_show"];
    default:
      return [];
  }
}

export function ReceptionClient() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showRequests, setShowRequests] = useState(false);
  const [appointments, setAppointments] = useState<StaffAppointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = showRequests ? "all=1&status=REQUESTED" : `date=${date}`;
    api<{ appointments: StaffAppointment[] }>(`/api/staff/appointments?${qs}`)
      .then((res) => {
        setAppointments(res.appointments);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [date, showRequests]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: string) {
    try {
      await api(`/api/staff/appointments/${id}`, {
        method: "PATCH",
        json: { action },
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={showRequests}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showRequests}
            onChange={(e) => setShowRequests(e.target.checked)}
          />
          All open booking requests
        </label>
        <span className="ml-auto text-xs text-slate-400">
          Refreshes every 15 s
        </span>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {appointments === null ? (
        <p className="text-slate-500">Loading…</p>
      ) : appointments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          No appointments {showRequests ? "awaiting confirmation" : "for this day"}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Queue #</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3">
                    {showRequests
                      ? new Date(a.scheduledAt).toLocaleDateString() +
                        " " +
                        fmtTime(a.scheduledAt)
                      : fmtTime(a.scheduledAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {a.patient.firstName} {a.patient.lastName}
                    </p>
                    {a.patient.phone && (
                      <p className="text-xs text-slate-400">{a.patient.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.doctor
                      ? `${a.doctor.title ? a.doctor.title + " " : ""}${a.doctor.firstName} ${a.doctor.lastName}`
                      : "Any"}
                  </td>
                  <td className="max-w-[16rem] px-4 py-3">
                    <p className="truncate" title={a.reason}>
                      {a.reason}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3">{a.queueNumber ?? "–"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {actionsFor(a.status).map((action) => (
                        <button
                          key={action}
                          onClick={() => act(a.id, action)}
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            action === "check_in"
                              ? "bg-teal-600 text-white hover:bg-teal-700"
                              : action === "confirm"
                                ? "bg-sky-600 text-white hover:bg-sky-700"
                                : "border border-slate-300 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {ACTION_LABEL[action]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
