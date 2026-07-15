import { Suspense } from "react";
import { AppShell } from "@/components/shell";
import { VerifyClient } from "./verify-client";

export const metadata = { title: "Verify email" };

export default function VerifyPage() {
  return (
    <AppShell title="Email verification">
      <Suspense fallback={<p className="text-slate-500">Verifying…</p>}>
        <VerifyClient />
      </Suspense>
    </AppShell>
  );
}
