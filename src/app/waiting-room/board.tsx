"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useLiveRefresh } from "@/lib/use-live";

interface PracticeOption {
  id: string;
  name: string;
}

interface QueueEntry {
  number: number | null;
  patient: string;
  doctor: string | null;
  status: string;
}

// Public board: designed to run full-screen on a lobby display, but equally
// usable on a patient's phone. Anonymized data only (see /api/waiting-room).
// Updates arrive live over SSE; a slow fallback poll covers dropped streams.
export function WaitingRoomBoard() {
  const [practices, setPractices] = useState<PracticeOption[]>([]);
  const [practiceId, setPracticeId] = useState<string>("");
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ practices: PracticeOption[] }>("/api/practices")
      .then((res) => {
        setPractices(res.practices);
        if (res.practices.length > 0) setPracticeId(res.practices[0].id);
        else setQueue([]);
      })
      .catch(() => setError("Could not load practices"));
  }, []);

  const load = useCallback(() => {
    if (!practiceId) return;
    api<{ queue: QueueEntry[]; asOf: string }>(
      `/api/waiting-room?practiceId=${encodeURIComponent(practiceId)}`,
    )
      .then((res) => {
        setQueue(res.queue);
        setAsOf(res.asOf);
        setError(null);
      })
      .catch(() => setError("Waiting room unavailable — retrying…"));
  }, [practiceId]);

  useEffect(load, [load]);
  useLiveRefresh(practiceId, load);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {practices.length > 1 && (
          <select
            value={practiceId}
            onChange={(e) => setPracticeId(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {asOf && (
          <span className="text-sm text-slate-500">
            Updated {new Date(asOf).toLocaleTimeString()} · live
          </span>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {queue === null ? (
        <p className="text-slate-500">Loading…</p>
      ) : queue.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          The waiting room is currently empty.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {queue.map((entry, i) => (
            <li
              key={`${entry.number}-${i}`}
              className={`flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm ${
                entry.status === "In consultation"
                  ? "border-indigo-300"
                  : "border-slate-200"
              }`}
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-teal-600 text-2xl font-bold text-white">
                {entry.number ?? "–"}
              </span>
              <div className="min-w-0">
                <p className="text-lg font-semibold">{entry.patient}</p>
                <p className="truncate text-sm text-slate-500">
                  {entry.doctor ?? "Any available doctor"}
                </p>
                <p
                  className={`text-sm font-medium ${
                    entry.status === "In consultation"
                      ? "text-indigo-600"
                      : "text-teal-700"
                  }`}
                >
                  {entry.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
