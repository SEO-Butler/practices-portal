"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export function VerifyBanner() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex-1">
        Your email address isn&apos;t verified yet — some notifications may
        not reach you.
      </p>
      {sent ? (
        <span className="font-medium text-emerald-700">
          Verification link sent ✓
        </span>
      ) : (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/auth/verify/request", { method: "POST" });
              setSent(true);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Resend verification email"}
        </button>
      )}
    </div>
  );
}
