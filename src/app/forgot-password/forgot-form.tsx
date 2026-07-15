"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      await api("/api/auth/password/forgot", {
        method: "POST",
        json: { email: data.get("email") },
      });
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="font-medium text-emerald-700">Check your inbox</p>
        <p className="mt-2 text-sm text-slate-600">
          If that email is registered, a reset link has been sent to it.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="mb-4 text-sm text-slate-600">
        Enter your account email and we&apos;ll send you a link to set a new
        password.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
        />
      </label>
      <button
        disabled={busy}
        className="mt-5 w-full rounded-md bg-teal-600 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
