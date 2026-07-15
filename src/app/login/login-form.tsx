"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      const res = await api<{ home: string }>("/api/auth/login", {
        method: "POST",
        json: {
          email: data.get("email"),
          password: data.get("password"),
        },
      });
      router.push(res.home);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
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
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-slate-600">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
        />
      </label>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button
        disabled={busy}
        className="mt-5 w-full rounded-md bg-teal-600 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-4 text-center text-sm text-slate-600">
        New patient?{" "}
        <Link href="/register" className="text-teal-700 underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/forgot-password" className="text-slate-500 underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
