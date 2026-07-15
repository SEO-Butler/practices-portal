"use client";

import { useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";
import { PushToggle } from "@/components/push-toggle";

interface Alert {
  id: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  readAt: string | null;
  createdAt: string;
}

const CHANNEL_CLASS: Record<string, string> = {
  EMAIL: "bg-sky-100 text-sky-800",
  SMS: "bg-violet-100 text-violet-800",
  PUSH: "bg-teal-100 text-teal-800",
};

export function AlertsClient() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ notifications: Alert[] }>("/api/notifications")
      .then((res) => {
        setAlerts(res.notifications);
        // Opening the feed marks everything read.
        return api("/api/notifications", { method: "POST" });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-rose-600">{error}</p>;
  if (alerts === null) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Every message the practice sends you (email and SMS deliveries are
          handled by the connected integration; entries marked{" "}
          <span className="font-medium">simulated</span> were not actually sent).
        </p>
        <PushToggle />
      </div>
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          No alerts yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                a.readAt ? "border-slate-200" : "border-teal-400"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    CHANNEL_CLASS[a.channel] ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {a.channel}
                </span>
                <p className="font-medium">{a.title}</p>
                {a.status === "SIMULATED" && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    simulated
                  </span>
                )}
                {a.status === "FAILED" && (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-800">
                    delivery failed
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">
                  {fmtDateTime(a.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm break-words text-slate-600">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
