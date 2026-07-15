"use client";

import { useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";
import { StatusBadge } from "@/components/status-badge";
import { CaseRecords, type CaseRecordsData } from "@/components/case-records";

interface HistoryCase extends CaseRecordsData {
  id: string;
  complaint: string;
  description: string | null;
  status: string;
  doctorNotes: string | null;
  createdAt: string;
  appointment: {
    scheduledAt: string;
    practice: { practiceName: string | null };
  } | null;
}

interface History {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  medicalAidName: string | null;
  cases: HistoryCase[];
  appointments: Array<{
    id: string;
    scheduledAt: string;
    status: string;
    reason: string;
  }>;
}

// Longitudinal view: every past case with its clinical records.
export function HistoryPanel({ patientId }: { patientId: string }) {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ patient: History }>(`/api/staff/patients/${patientId}/history`)
      .then((res) => setHistory(res.patient))
      .catch((err) => setError(err.message));
  }, [patientId]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!history) return <p className="text-sm text-slate-500">Loading history…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {history.cases.length} case{history.cases.length === 1 ? "" : "s"} ·{" "}
        {history.appointments.length} recent visit
        {history.appointments.length === 1 ? "" : "s"}
        {history.chronicConditions ? ` · Chronic: ${history.chronicConditions}` : ""}
      </p>
      {history.cases.length === 0 ? (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
          No previous cases on record.
        </p>
      ) : (
        <ul className="space-y-3">
          {history.cases.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{c.complaint}</p>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-xs text-slate-400">
                {fmtDateTime(c.createdAt)}
                {c.appointment?.practice.practiceName
                  ? ` · ${c.appointment.practice.practiceName}`
                  : ""}
              </p>
              {c.doctorNotes && (
                <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">
                  {c.doctorNotes}
                </p>
              )}
              <CaseRecords data={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
