import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { AuditClient } from "./audit-client";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePage(["MANAGER"]);
  return (
    <AppShell title="Audit log">
      <AuditClient />
    </AppShell>
  );
}
