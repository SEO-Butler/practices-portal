"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime, fmtTime } from "@/lib/client";
import { StatusBadge } from "@/components/status-badge";
import { useLiveRefresh } from "@/lib/use-live";
import { VitalsSummary } from "@/components/vitals-summary";
import { TrendChart, type TrendSeries } from "@/components/trend-chart";
import { normalBand } from "@/lib/vitals-flags";
import { CaseRecords, type CaseRecordsData } from "@/components/case-records";
import { CaseTools } from "./case-tools";
import { HistoryPanel } from "./history-panel";

interface QueueAppointment {
  id: string;
  scheduledAt: string;
  status: string;
  queueNumber: number | null;
  reason: string;
  patient: { firstName: string; lastName: string };
  doctor: { id: string } | null;
  case: { id: string; complaint: string; status: string } | null;
}

interface Detail {
  id: string;
  reason: string;
  status: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    phone: string | null;
    medicalAidName: string | null;
    allergies: string | null;
    chronicConditions: string | null;
  };
  case:
    | ({
        id: string;
        complaint: string;
        description: string | null;
        status: string;
        doctorNotes: string | null;
      } & CaseRecordsData)
    | null;
  vitals: Array<{
    id: string;
    source: string;
    systolic: number | null;
    diastolic: number | null;
    heartRate: number | null;
    respiratoryRate: number | null;
    temperatureC: number | null;
    oxygenSat: number | null;
    painLevel: number | null;
    notes: string | null;
    recordedAt: string;
  }>;
}

interface HistoryVitals {
  systolic: number | null;
  diastolic: number | null;
  heartRate: number | null;
  recordedAt: string;
}

function toSeries(
  history: HistoryVitals[],
  key: "systolic" | "diastolic" | "heartRate",
  name: string,
): TrendSeries {
  return {
    name,
    points: history
      .filter((h) => h[key] != null)
      .map((h) => ({ t: new Date(h.recordedAt).getTime(), v: h[key]! })),
  };
}

const ACTIVE_STATUSES = ["CHECKED_IN", "IN_CONSULT"];

export function DoctorClient() {
  const [mineOnly, setMineOnly] = useState(true);
  const [queue, setQueue] = useState<QueueAppointment[] | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [history, setHistory] = useState<HistoryVitals[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    api<{ appointments: QueueAppointment[]; practiceId: string }>(
      `/api/staff/appointments?${mineOnly ? "mine=1" : ""}`,
    )
      .then((res) => {
        setQueue(res.appointments.filter((a) => ACTIVE_STATUSES.includes(a.status)));
        setPracticeId(res.practiceId);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [mineOnly]);

  useEffect(loadQueue, [loadQueue]);
  useLiveRefresh(practiceId, loadQueue);

  const loadDetail = useCallback((id: string) => {
    api<{ appointment: Detail; patientVitals: HistoryVitals[] }>(
      `/api/staff/appointments/${id}`,
    )
      .then((res) => {
        setDetail(res.appointment);
        setHistory(res.patientVitals);
        setNotes(res.appointment.case?.doctorNotes ?? "");
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function act(action: "start_consult" | "complete") {
    if (!selectedId) return;
    setError(null);
    try {
      await api(`/api/staff/appointments/${selectedId}`, {
        method: "PATCH",
        json: { action },
      });
      loadQueue();
      if (action === "complete") {
        setSelectedId(null);
        setDetail(null);
        setMessage("Consultation completed.");
      } else {
        loadDetail(selectedId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function saveNotes(close: boolean) {
    if (!detail?.case) return;
    setError(null);
    setMessage(null);
    try {
      await api(`/api/staff/cases/${detail.case.id}`, {
        method: "PATCH",
        json: {
          doctorNotes: notes,
          ...(close ? { status: "CLOSED" } : { status: "IN_PROGRESS" }),
        },
      });
      setMessage(close ? "Notes saved and case closed." : "Notes saved.");
      if (selectedId) loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Today&apos;s queue</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            My patients only
          </label>
        </div>
        {queue === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No patients in the queue.
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
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold text-white ${
                      a.status === "IN_CONSULT" ? "bg-indigo-600" : "bg-teal-600"
                    }`}
                  >
                    {a.queueNumber ?? "–"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {a.patient.firstName} {a.patient.lastName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {fmtTime(a.scheduledAt)} · {a.case?.complaint ?? a.reason}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
      </section>

      <section className="lg:col-span-3">
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        {!detail ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
            Select a patient to view their case, vitals and history.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {detail.patient.firstName} {detail.patient.lastName}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {detail.patient.dateOfBirth
                      ? `Born ${new Date(detail.patient.dateOfBirth).toLocaleDateString()} · `
                      : ""}
                    {detail.patient.medicalAidName ?? "No medical aid on file"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {detail.status === "CHECKED_IN" && (
                    <button
                      onClick={() => act("start_consult")}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Start consult
                    </button>
                  )}
                  {detail.status === "IN_CONSULT" && (
                    <button
                      onClick={() => act("complete")}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
              {detail.patient.allergies && (
                <p className="mt-3 rounded-md bg-rose-50 p-2 text-sm font-medium text-rose-700">
                  Allergies: {detail.patient.allergies}
                </p>
              )}
              {detail.patient.chronicConditions && (
                <p className="mt-2 text-sm text-slate-600">
                  Chronic: {detail.patient.chronicConditions}
                </p>
              )}
              <p className="mt-3 text-sm">
                <span className="text-slate-500">Reason for visit: </span>
                {detail.reason}
              </p>
              <button
                onClick={() => setShowHistory((s) => !s)}
                className="mt-3 text-sm font-medium text-teal-700 underline"
              >
                {showHistory ? "Hide patient history" : "View full patient history"}
              </button>
              {showHistory && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <HistoryPanel patientId={detail.patient.id} />
                </div>
              )}
            </div>

            {detail.case ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Case: {detail.case.complaint}</h3>
                  <StatusBadge status={detail.case.status} />
                </div>
                {detail.case.description && (
                  <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600">
                    {detail.case.description}
                  </p>
                )}
                <label className="mt-4 block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Doctor&apos;s notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => saveNotes(false)}
                    className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Save notes
                  </button>
                  <button
                    onClick={() => saveNotes(true)}
                    className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Save &amp; close case
                  </button>
                </div>
                <CaseRecords data={detail.case} />
                <CaseTools
                  caseId={detail.case.id}
                  onSaved={() => selectedId && loadDetail(selectedId)}
                />
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                No case attached to this visit.
              </p>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold">Vitals</h3>
              {detail.vitals.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No vitals recorded for this visit yet.
                </p>
              ) : (
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
                      <VitalsSummary v={v} />
                      {v.notes && (
                        <span className="text-slate-400">— {v.notes}</span>
                      )}
                      <span className="text-xs text-slate-400">
                        {fmtDateTime(v.recordedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <TrendChart
                title="Blood pressure trend"
                unit="mmHg"
                series={[
                  toSeries(history, "systolic", "Systolic"),
                  toSeries(history, "diastolic", "Diastolic"),
                ].filter((s) => s.points.length > 0)}
                band={normalBand("systolic")}
              />
              <TrendChart
                title="Heart rate trend"
                unit="bpm"
                series={[toSeries(history, "heartRate", "Heart rate")]}
                band={normalBand("heartRate")}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
