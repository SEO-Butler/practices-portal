"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";
import { StatusBadge } from "@/components/status-badge";
import { VitalsFields, vitalsFromForm } from "@/components/vitals-fields";
import { VitalsSummary } from "@/components/vitals-summary";

interface Vitals {
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
}

interface MedicalCase {
  id: string;
  complaint: string;
  description: string | null;
  status: string;
  doctorNotes: string | null;
  createdAt: string;
  vitals: Vitals[];
}

const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none";

export function CasesClient() {
  const [cases, setCases] = useState<MedicalCase[] | null>(null);
  const [showVitals, setShowVitals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ cases: MedicalCase[] }>("/api/patient/cases")
      .then((res) => setCases(res.cases))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const vitals = showVitals ? vitalsFromForm(form) : null;
    try {
      await api("/api/patient/cases", {
        method: "POST",
        json: {
          complaint: data.get("complaint"),
          description: data.get("description"),
          ...(vitals && Object.keys(vitals).length > 0 ? { vitals } : {}),
        },
      });
      setMessage("Case submitted. Your care team can now see it.");
      form.reset();
      setShowVitals(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"
      >
        <h2 className="mb-1 font-semibold">New complaint</h2>
        <p className="mb-4 text-sm text-slate-500">
          Describe what&apos;s bothering you. You can add your own vitals
          (blood pressure, heart rate, …) taken at home.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Main complaint</span>
          <input
            name="complaint"
            required
            maxLength={300}
            placeholder="e.g. Persistent headache"
            className={input}
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-slate-600">Details</span>
          <textarea
            name="description"
            rows={4}
            placeholder="When did it start? What makes it better or worse?"
            className={input}
          />
        </label>
        <button
          type="button"
          onClick={() => setShowVitals((s) => !s)}
          className="mt-4 text-sm font-medium text-teal-700 underline"
        >
          {showVitals ? "Remove self-recorded vitals" : "Add self-recorded vitals"}
        </button>
        {showVitals && (
          <div className="mt-3">
            <VitalsFields />
          </div>
        )}
        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button
          disabled={busy}
          className="mt-5 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit case"}
        </button>
      </form>

      <section className="lg:col-span-3">
        <h2 className="mb-3 font-semibold">Case history</h2>
        {cases === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="text-sm text-slate-500">No cases yet.</p>
        ) : (
          <ul className="space-y-4">
            {cases.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.complaint}</p>
                    <p className="text-xs text-slate-400">
                      Opened {fmtDateTime(c.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                {c.description && (
                  <p className="mt-2 text-sm text-slate-600">{c.description}</p>
                )}
                {c.doctorNotes && (
                  <div className="mt-3 rounded-md bg-teal-50 p-3 text-sm">
                    <p className="font-medium text-teal-800">Doctor&apos;s notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-teal-900">
                      {c.doctorNotes}
                    </p>
                  </div>
                )}
                {c.vitals.length > 0 && (
                  <div className="mt-3 text-sm">
                    <p className="font-medium text-slate-600">Vitals</p>
                    <ul className="mt-1 space-y-1">
                      {c.vitals.map((v) => (
                        <li key={v.id} className="text-slate-500">
                          <span
                            className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                              v.source === "SELF"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-teal-100 text-teal-800"
                            }`}
                          >
                            {v.source === "SELF" ? "Self" : "Nurse"}
                          </span>
                          <VitalsSummary v={v} />
                          <span className="ml-2 text-xs text-slate-400">
                            {fmtDateTime(v.recordedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
