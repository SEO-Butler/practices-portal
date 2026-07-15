"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";

interface Entry {
  id: string;
  action: string;
  actor: string;
  actorRole: string | null;
  patient: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

const FILTERS = [
  { value: "", label: "All activity" },
  { value: "chart.view", label: "Chart views" },
  { value: "appointment.", label: "Appointments" },
  { value: "vitals.", label: "Vitals" },
  { value: "case.", label: "Cases" },
  { value: "staff.", label: "Staff changes" },
];

const ACTION_CLASS: Record<string, string> = {
  chart: "bg-indigo-100 text-indigo-800",
  appointment: "bg-teal-100 text-teal-800",
  vitals: "bg-sky-100 text-sky-800",
  case: "bg-amber-100 text-amber-800",
  staff: "bg-violet-100 text-violet-800",
  auth: "bg-slate-200 text-slate-700",
};

export function AuditClient() {
  const [filter, setFilter] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((action: string, cursor?: string) => {
    const qs = new URLSearchParams();
    if (action) qs.set("action", action);
    if (cursor) qs.set("cursor", cursor);
    api<{ entries: Entry[]; nextCursor: string | null }>(
      `/api/manager/audit?${qs}`,
    )
      .then((res) => {
        setEntries((prev) => (cursor && prev ? [...prev, ...res.entries] : res.entries));
        setNextCursor(res.nextCursor);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => load(filter), [filter, load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-500">
          Append-only record of access and changes at your practice.
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {entries === null ? (
        <p className="text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          No audit entries yet.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                      {fmtDateTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          ACTION_CLASS[e.action.split(".")[0]] ??
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {e.actor}
                      {e.actorRole && (
                        <span className="ml-1 text-xs text-slate-400">
                          ({e.actorRole.toLowerCase()})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{e.patient ?? "–"}</td>
                    <td className="max-w-[16rem] px-4 py-2.5 text-xs text-slate-500">
                      {e.details && Object.keys(e.details).length > 0
                        ? Object.entries(e.details)
                            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                            .join(", ")
                        : "–"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {e.ip ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <button
              onClick={() => load(filter, nextCursor)}
              className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Load older entries
            </button>
          )}
        </>
      )}
    </div>
  );
}
