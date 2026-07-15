import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSession } from "@/lib/session";
import { ChangePasswordForm } from "./change-form";
import { SessionsPanel } from "./sessions-panel";

export const metadata = { title: "Change password" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <AppShell title="Change password">
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <ChangePasswordForm />
      </Suspense>
      <SessionsPanel />
    </AppShell>
  );
}
