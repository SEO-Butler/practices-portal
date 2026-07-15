import { Suspense } from "react";
import { AppShell } from "@/components/shell";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AppShell title="Set a new password">
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </AppShell>
  );
}
