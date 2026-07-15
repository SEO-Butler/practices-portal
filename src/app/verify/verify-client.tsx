"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";

export function VerifyClient() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "failed">(
    token ? "working" : "failed",
  );
  const [error, setError] = useState<string>(
    token ? "" : "This verification link is incomplete.",
  );

  useEffect(() => {
    if (!token) return;
    api("/api/auth/verify/confirm", { method: "POST", json: { token } })
      .then(() => setState("done"))
      .catch((err) => {
        setState("failed");
        setError(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token]);

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      {state === "working" && <p className="text-slate-500">Verifying your email…</p>}
      {state === "done" && (
        <>
          <p className="text-lg font-semibold text-emerald-700">Email verified ✓</p>
          <p className="mt-2 text-sm text-slate-600">
            Thanks — your account email is confirmed.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
          >
            Continue
          </Link>
        </>
      )}
      {state === "failed" && (
        <>
          <p className="font-medium text-rose-600">{error}</p>
          <p className="mt-2 text-sm text-slate-600">
            Sign in and request a new verification email from your dashboard.
          </p>
        </>
      )}
    </div>
  );
}
