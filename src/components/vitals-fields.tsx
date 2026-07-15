"use client";

// Shared vitals inputs, used by patient self-capture and the nurse station.
// Values are read out of the form with vitalsFromForm().

const FIELDS: Array<{ name: string; label: string; step?: string }> = [
  { name: "systolic", label: "BP systolic (mmHg)" },
  { name: "diastolic", label: "BP diastolic (mmHg)" },
  { name: "heartRate", label: "Heart rate (bpm)" },
  { name: "respiratoryRate", label: "Resp. rate (/min)" },
  { name: "temperatureC", label: "Temperature (°C)", step: "0.1" },
  { name: "oxygenSat", label: "SpO₂ (%)" },
  { name: "weightKg", label: "Weight (kg)", step: "0.1" },
  { name: "heightCm", label: "Height (cm)", step: "0.1" },
  { name: "glucoseMmol", label: "Glucose (mmol/L)", step: "0.1" },
  { name: "painLevel", label: "Pain level (0–10)" },
];

export function VitalsFields() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {FIELDS.map((f) => (
        <label key={f.name} className="block text-sm">
          <span className="mb-1 block text-slate-600">{f.label}</span>
          <input
            type="number"
            name={f.name}
            step={f.step ?? "1"}
            inputMode="decimal"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 focus:border-teal-500 focus:outline-none"
          />
        </label>
      ))}
      <label className="col-span-2 block text-sm sm:col-span-3">
        <span className="mb-1 block text-slate-600">Notes</span>
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 focus:border-teal-500 focus:outline-none"
        />
      </label>
    </div>
  );
}

export function vitalsFromForm(form: HTMLFormElement): Record<string, unknown> {
  const data = new FormData(form);
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) {
    const v = data.get(f.name);
    if (typeof v === "string" && v.trim() !== "") out[f.name] = Number(v);
  }
  const notes = data.get("notes");
  if (typeof notes === "string" && notes.trim()) out.notes = notes.trim();
  return out;
}
