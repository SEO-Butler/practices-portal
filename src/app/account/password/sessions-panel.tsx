"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";

interface SessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

export function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ sessions: SessionInfo[] }>("/api/auth/sessions")
      .then((res) => setSessions(res.sessions))
      .catch(() => setSessions([]));
  }, []);

  useEffect(load, [load]);

  async function revokeOthers() {
    const res = await api<{ revoked: number }>("/api/auth/sessions", {
      method: "DELETE",
    });
    setMessage(
      res.revoked === 0
        ? "No other devices were signed in."
        : `Signed out ${res.revoked} other device${res.revoked === 1 ? "" : "s"}.`,
    );
    load();
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold">Active sessions</h2>
      {sessions === null ? (
        <p className="mt-2 text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-md border border-slate-100 p-2">
              <p className="font-medium">
                {s.current ? "This device" : "Other device"}
                {s.ip ? ` · ${s.ip}` : ""}
              </p>
              <p className="truncate text-xs text-slate-400" title={s.userAgent ?? ""}>
                {s.userAgent ?? "Unknown browser"}
              </p>
              <p className="text-xs text-slate-400">
                Last active {fmtDateTime(s.lastSeenAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
      <button
        onClick={revokeOthers}
        className="mt-4 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
      >
        Sign out everywhere else
      </button>
    </section>
  );
}
