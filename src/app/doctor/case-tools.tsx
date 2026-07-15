"use client";

import { useState } from "react";
import { api } from "@/lib/client";

const input =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none";

type Tool = "diagnosis" | "prescription" | "sick_note" | null;

// Doctor's add-record toolbar for the open case: diagnosis, prescription,
// sick note. Calls back with the refreshed case after each save.
export function CaseTools({
  caseId,
  onSaved,
}: {
  caseId: string;
  onSaved: () => void;
}) {
  const [tool, setTool] = useState<Tool>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(payload: Record<string, unknown>, form: HTMLFormElement) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/staff/cases/${caseId}/records`, {
        method: "POST",
        json: payload,
      });
      form.reset();
      setTool(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function handler(builder: (d: FormData) => Record<string, unknown>) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      submit(builder(new FormData(e.currentTarget)), e.currentTarget);
    };
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["diagnosis", "+ Diagnosis"],
            ["prescription", "+ Prescription"],
            ["sick_note", "+ Sick note"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTool(tool === key ? null : key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              tool === key
                ? "bg-teal-600 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      {tool === "diagnosis" && (
        <form
          onSubmit={handler((d) => ({
            type: "diagnosis",
            description: d.get("description"),
            icdCode: d.get("icdCode"),
          }))}
          className="mt-3 grid grid-cols-4 gap-2"
        >
          <input name="icdCode" placeholder="ICD code (opt.)" className={input} />
          <input
            name="description"
            placeholder="Diagnosis description"
            required
            className={`${input} col-span-2`}
          />
          <button
            disabled={busy}
            className="rounded-md bg-teal-600 px-3 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}

      {tool === "prescription" && (
        <form
          onSubmit={handler((d) => ({
            type: "prescription",
            medication: d.get("medication"),
            dosage: d.get("dosage"),
            frequency: d.get("frequency"),
            durationDays: d.get("durationDays") || null,
            instructions: d.get("instructions"),
          }))}
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6"
        >
          <input
            name="medication"
            placeholder="Medication"
            required
            className={`${input} sm:col-span-2`}
          />
          <input name="dosage" placeholder="Dosage (e.g. 5 mg)" required className={input} />
          <input
            name="frequency"
            placeholder="Frequency (e.g. 1× daily)"
            required
            className={input}
          />
          <input
            name="durationDays"
            type="number"
            min="1"
            max="365"
            placeholder="Days"
            className={input}
          />
          <button
            disabled={busy}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Add
          </button>
          <input
            name="instructions"
            placeholder="Instructions (optional)"
            className={`${input} col-span-2 sm:col-span-6`}
          />
        </form>
      )}

      {tool === "sick_note" && (
        <form
          onSubmit={handler((d) => ({
            type: "sick_note",
            fromDate: d.get("fromDate"),
            toDate: d.get("toDate"),
            note: d.get("note"),
          }))}
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"
        >
          <input name="fromDate" type="date" required className={input} />
          <input name="toDate" type="date" required className={input} />
          <input
            name="note"
            placeholder="Note (optional)"
            className={`${input} col-span-2`}
          />
          <button
            disabled={busy}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Issue
          </button>
        </form>
      )}
    </div>
  );
}
