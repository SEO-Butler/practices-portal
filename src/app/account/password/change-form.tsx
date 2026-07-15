"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";

export function ChangePasswordForm() {
  const router = useRouter();
  const required = useSearchParams().get("required") === "1";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (data.get("newPassword") !== data.get("confirm")) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/password/change", {
        method: "POST",
        json: {
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
        },
      });
      const me = await api<{ user: { home: string } | null }>("/api/auth/me");
      router.push(me.user?.home ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Change failed");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {required && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          You&apos;re using a temporary password. Please set your own password
          to continue.
        </p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Current password</span>
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
        />
      </label>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-slate-600">New password (min. 8 characters)</span>
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
        />
      </label>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-slate-600">Confirm new password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
        />
      </label>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button
        disabled={busy}
        className="mt-5 w-full rounded-md bg-teal-600 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
