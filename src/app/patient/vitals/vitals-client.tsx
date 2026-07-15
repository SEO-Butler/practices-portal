"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";
import { VitalsFields, vitalsFromForm } from "@/components/vitals-fields";
import { TrendChart, type TrendSeries } from "@/components/trend-chart";
import { FlaggedBp, FlaggedValue } from "@/components/flagged-value";
import { normalBand } from "@/lib/vitals-flags";

interface Vitals {
  id: string;
  source: string;
  systolic: number | null;
  diastolic: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperatureC: number | null;
  oxygenSat: number | null;
  weightKg: number | null;
  glucoseMmol: number | null;
  painLevel: number | null;
  notes: string | null;
  recordedAt: string;
}

type NumericKey =
  | "systolic"
  | "diastolic"
  | "heartRate"
  | "temperatureC"
  | "oxygenSat"
  | "weightKg"
  | "glucoseMmol";

function seriesOf(vitals: Vitals[], key: NumericKey, name: string): TrendSeries {
  return {
    name,
    points: [...vitals]
      .reverse() // API returns newest first; charts need ascending time
      .filter((v) => v[key] != null)
      .map((v) => ({ t: new Date(v.recordedAt).getTime(), v: v[key]! })),
  };
}

export function VitalsClient() {
  const [vitals, setVitals] = useState<Vitals[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ vitals: Vitals[] }>("/api/patient/vitals")
      .then((res) => setVitals(res.vitals))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    try {
      await api("/api/patient/vitals", {
        method: "POST",
        json: vitalsFromForm(form),
      });
      setMessage("Vitals recorded.");
      form.reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording failed");
    } finally {
      setBusy(false);
    }
  }

  const charts =
    vitals && vitals.length > 0
      ? [
          {
            title: "Blood pressure",
            unit: "mmHg",
            series: [
              seriesOf(vitals, "systolic", "Systolic"),
              seriesOf(vitals, "diastolic", "Diastolic"),
            ].filter((s) => s.points.length > 0),
            band: normalBand("systolic"),
          },
          {
            title: "Heart rate",
            unit: "bpm",
            series: [seriesOf(vitals, "heartRate", "Heart rate")],
            band: normalBand("heartRate"),
          },
          {
            title: "Oxygen saturation",
            unit: "%",
            series: [seriesOf(vitals, "oxygenSat", "SpO₂")],
            band: normalBand("oxygenSat"),
          },
          {
            title: "Glucose",
            unit: "mmol/L",
            series: [seriesOf(vitals, "glucoseMmol", "Glucose")],
            band: normalBand("glucoseMmol"),
          },
          {
            title: "Weight",
            unit: "kg",
            series: [seriesOf(vitals, "weightKg", "Weight")],
            band: null,
          },
        ].filter((c) => c.series.reduce((n, s) => n + s.points.length, 0) >= 2)
      : [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-1 font-semibold">Record home measurements</h2>
        <p className="mb-4 text-sm text-slate-500">
          Fill in whichever readings you have — leave the rest blank.
        </p>
        <VitalsFields />
        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button
          disabled={busy}
          className="mt-5 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save vitals"}
        </button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">History</h2>
        {vitals === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : vitals.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">BP</th>
                  <th className="py-2 pr-3 font-medium">HR</th>
                  <th className="py-2 pr-3 font-medium">Temp</th>
                  <th className="py-2 pr-3 font-medium">SpO₂</th>
                  <th className="py-2 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {fmtDateTime(v.recordedAt)}
                    </td>
                    <td className="py-2 pr-3">
                      {v.systolic != null ? (
                        <FlaggedBp systolic={v.systolic} diastolic={v.diastolic} />
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {v.heartRate != null ? (
                        <FlaggedValue
                          metric="heartRate"
                          value={v.heartRate}
                          text={String(v.heartRate)}
                        />
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {v.temperatureC != null ? (
                        <FlaggedValue
                          metric="temperatureC"
                          value={v.temperatureC}
                          text={`${v.temperatureC}°C`}
                        />
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {v.oxygenSat != null ? (
                        <FlaggedValue
                          metric="oxygenSat"
                          value={v.oxygenSat}
                          text={`${v.oxygenSat}%`}
                        />
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="py-2">
                      {v.source === "SELF" ? "Me" : "Nurse"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {charts.length > 0 && (
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Trends</h2>
          <p className="mb-3 text-sm text-slate-500">
            Shaded area shows the typical range. Values outside it are
            highlighted in your history above (▲ high, ▼ low).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {charts.map((c) => (
              <TrendChart
                key={c.title}
                title={c.title}
                unit={c.unit}
                series={c.series}
                band={c.band}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
