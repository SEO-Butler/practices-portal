"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Profile {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phone: string | null;
  address: string | null;
  medicalAidName: string | null;
  medicalAidNumber: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  emergencyContact: string | null;
}

const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none";

const FIELDS: Array<{
  name: keyof Profile;
  label: string;
  type?: string;
  span?: boolean;
  textarea?: boolean;
}> = [
  { name: "firstName", label: "First name" },
  { name: "lastName", label: "Last name" },
  { name: "dateOfBirth", label: "Date of birth", type: "date" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "address", label: "Address", span: true },
  { name: "medicalAidName", label: "Medical aid" },
  { name: "medicalAidNumber", label: "Medical aid number" },
  { name: "emergencyContact", label: "Emergency contact", span: true },
  { name: "allergies", label: "Allergies", span: true, textarea: true },
  { name: "chronicConditions", label: "Chronic conditions", span: true, textarea: true },
];

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ profile: Profile }>("/api/patient/profile")
      .then((res) => setProfile(res.profile))
      .catch((err) => setError(err.message));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const data = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const f of FIELDS) payload[f.name] = data.get(f.name);
    try {
      const res = await api<{ profile: Profile }>("/api/patient/profile", {
        method: "PUT",
        json: payload,
      });
      setProfile(res.profile);
      setMessage("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !profile) return <p className="text-rose-600">{error}</p>;
  if (!profile) return <p className="text-slate-500">Loading…</p>;

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="mb-4 text-sm text-slate-500">
        Keep your personal and medical details up to date — your practice sees
        this information when you visit.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label
            key={f.name}
            className={`block text-sm ${f.span ? "sm:col-span-2" : ""}`}
          >
            <span className="mb-1 block text-slate-600">{f.label}</span>
            {f.textarea ? (
              <textarea
                name={f.name}
                rows={2}
                defaultValue={profile[f.name] ?? ""}
                className={input}
              />
            ) : (
              <input
                name={f.name}
                type={f.type ?? "text"}
                defaultValue={
                  f.type === "date" && profile[f.name]
                    ? String(profile[f.name]).slice(0, 10)
                    : (profile[f.name] ?? "")
                }
                required={f.name === "firstName" || f.name === "lastName"}
                className={input}
              />
            )}
          </label>
        ))}
      </div>
      {message && <p className="mt-4 text-sm text-emerald-600">{message}</p>}
      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      <button
        disabled={busy}
        className="mt-5 rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
