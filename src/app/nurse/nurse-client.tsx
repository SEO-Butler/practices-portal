"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime, fmtTime } from "@/lib/client";
import { StatusBadge } from "@/components/status-badge";
import { VitalsFields, vitalsFromForm } from "@/components/vitals-fields";

interface QueueAppointment {
  id: string;
  scheduledAt: string;
  status: string;
  queueNumber: number | null;
  reason: string;
  patient: { firstName: string; lastName: string };
  vitals: Array<{ id: string; source: string }>;
}

interface Detail {
  id: string;
  reason: string;
  status: string;
  queueNumber: number | null;
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    allergies: string | null;
    chronicConditions: string | null;
  };
  case: {
    id: string;
    complaint: string;
    description: string | null;
    status: string;
  } | null;
  vitals: Array<{
    id: string;
    source: string;
    systolic: number | null;
    diastolic: number | null;
    heartRate: number | null;
    temperatureC: number | null;
    oxygenSat: number | null;
    painLevel: number | null;
    notes: string | null;
    recordedAt: string;
  }>;
}

export function NurseClient() {
  const [queue, setQueue] = useState<QueueAppointment[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(() => {
    api<{ appointments: QueueAppointment[] }>(
      "/api/staff/appointments?status=CHECKED_IN",
    )
      .then((res) => {
        setQueue(res.appointments);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadQueue();
    const t = setInterval(loadQueue, 15_000);
    return () => clearInterval(t);
  }, [loadQueue]);

  useEffect(() => {
    if (!selectedId) return;
    api<{ appointment: Detail }>(`/api/staff/appointments/${selectedId}`)
      .then((res) => setDetail(res.appointment))
      .catch((err) => setError(err.message));
  }, [selectedId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    try {
      await api("/api/staff/vitals", {
        method: "POST",
        json: { appointmentId: selectedId, ...vitalsFromForm(form) },
      });
      setMessage("Vitals captured.");
      form.reset();
      const res = await api<{ appointment: Detail }>(
        `/api/staff/appointments/${selectedId}`,
      );
      setDetail(res.appointment);
      loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="lg:col-span-2">
        <h2 className="mb-3 font-semibold">Waiting queue</h2>
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        {queue === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No patients waiting.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelectedId(a.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition ${
                    selectedId === a.id
                      ? "border-teal-500 ring-1 ring-teal-500"
                      : "border-slate-200 hover:border-teal-300"
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-600 font-bold text-white">
                    {a.queueNumber ?? "–"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {a.patient.firstName} {a.patient.lastName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {fmtTime(a.scheduledAt)} · {a.reason}
                    </span>
                  </span>
                  {a.vitals.length > 0 && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                      Vitals ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lg:col-span-3">
        {!detail ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
            Select a patient from the queue to view details and capture vitals.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {detail.patient.firstName} {detail.patient.lastName}
                  </h2>
                  {detail.patient.dateOfBirth && (
                    <p className="text-sm text-slate-500">
                      Born {new Date(detail.patient.dateOfBirth).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <StatusBadge status={detail.status} />
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Reason for visit</dt>
                  <dd>{detail.reason}</dd>
                </div>
                {detail.case && (
                  <div>
                    <dt className="text-slate-500">Complaint (case)</dt>
                    <dd>{detail.case.complaint}</dd>
                  </div>
                )}
                {detail.patient.allergies && (
                  <div>
                    <dt className="text-rose-600">Allergies</dt>
                    <dd className="font-medium">{detail.patient.allergies}</dd>
                  </div>
                )}
                {detail.patient.chronicConditions && (
                  <div>
                    <dt className="text-slate-500">Chronic conditions</dt>
                    <dd>{detail.patient.chronicConditions}</dd>
                  </div>
                )}
              </dl>
            </div>

            <form
              onSubmit={onSubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="mb-3 font-semibold">Capture vitals</h3>
              <VitalsFields />
              {message && (
                <p className="mt-3 text-sm text-emerald-600">{message}</p>
              )}
              {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
              <button
                disabled={busy}
                className="mt-4 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save vitals"}
              </button>
            </form>

            {detail.vitals.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-semibold">Previous readings</h3>
                <ul className="space-y-2 text-sm">
                  {detail.vitals.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          v.source === "SELF"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-teal-100 text-teal-800"
                        }`}
                      >
                        {v.source === "SELF" ? "Self" : "Nurse"}
                      </span>
                      <span className="text-slate-600">
                        {[
                          v.systolic != null
                            ? `BP ${v.systolic}/${v.diastolic ?? "–"}`
                            : null,
                          v.heartRate != null ? `HR ${v.heartRate}` : null,
                          v.temperatureC != null ? `${v.temperatureC}°C` : null,
                          v.oxygenSat != null ? `SpO₂ ${v.oxygenSat}%` : null,
                          v.painLevel != null ? `Pain ${v.painLevel}/10` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "notes only"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {fmtDateTime(v.recordedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
