import { fmtDateTime } from "@/lib/client";

export interface DiagnosisR {
  id: string;
  icdCode: string | null;
  description: string;
  createdAt: string;
}
export interface PrescriptionR {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  durationDays: number | null;
  instructions: string | null;
  createdAt: string;
}
export interface SickNoteR {
  id: string;
  fromDate: string;
  toDate: string;
  note: string | null;
  createdAt: string;
}
export interface AttachmentR {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface CaseRecordsData {
  diagnoses?: DiagnosisR[];
  prescriptions?: PrescriptionR[];
  sickNotes?: SickNoteR[];
  attachments?: AttachmentR[];
}

function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Read-only clinical record lists, shared by doctor and patient views. */
export function CaseRecords({ data }: { data: CaseRecordsData }) {
  const { diagnoses = [], prescriptions = [], sickNotes = [], attachments = [] } = data;
  if (
    diagnoses.length + prescriptions.length + sickNotes.length + attachments.length ===
    0
  ) {
    return null;
  }
  return (
    <div className="mt-3 space-y-3 text-sm">
      {diagnoses.length > 0 && (
        <div>
          <p className="font-medium text-slate-600">Diagnoses</p>
          <ul className="mt-1 space-y-1">
            {diagnoses.map((d) => (
              <li key={d.id} className="text-slate-700">
                {d.icdCode && (
                  <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-xs text-indigo-800">
                    {d.icdCode}
                  </span>
                )}
                {d.description}
                <span className="ml-2 text-xs text-slate-400">
                  {fmtDateTime(d.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {prescriptions.length > 0 && (
        <div>
          <p className="font-medium text-slate-600">Prescriptions</p>
          <ul className="mt-1 space-y-1">
            {prescriptions.map((p) => (
              <li key={p.id} className="text-slate-700">
                <span className="font-medium">{p.medication}</span> — {p.dosage},{" "}
                {p.frequency}
                {p.durationDays ? ` for ${p.durationDays} days` : ""}
                {p.instructions && (
                  <span className="text-slate-500"> · {p.instructions}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sickNotes.length > 0 && (
        <div>
          <p className="font-medium text-slate-600">Sick notes</p>
          <ul className="mt-1 space-y-1">
            {sickNotes.map((s) => (
              <li key={s.id} className="text-slate-700">
                Off work {new Date(s.fromDate).toLocaleDateString()} –{" "}
                {new Date(s.toDate).toLocaleDateString()}
                {s.note && <span className="text-slate-500"> · {s.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {attachments.length > 0 && (
        <div>
          <p className="font-medium text-slate-600">Attachments</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-teal-400"
                >
                  {a.mimeType.startsWith("image/") ? "🖼" : "📄"} {a.filename}
                  <span className="text-slate-400">({fmtSize(a.sizeBytes)})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
