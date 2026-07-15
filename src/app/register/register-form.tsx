"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      await api("/api/auth/register", {
        method: "POST",
        json: {
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          phone: data.get("phone"),
          password: data.get("password"),
        },
      });
      router.push("/patient");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">First name</span>
          <input name="firstName" required className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Last name</span>
          <input name="lastName" required className={input} />
        </label>
      </div>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-slate-600">Email</span>
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-slate-600">Phone (optional)</span>
        <input name="phone" type="tel" autoComplete="tel" className={input} />
      </label>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-slate-600">Password (min. 8 characters)</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={input}
        />
      </label>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button
        disabled={busy}
        className="mt-5 w-full rounded-md bg-teal-600 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link href="/login" className="text-teal-700 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
