import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { AlertsClient } from "./alerts-client";

export const metadata = { title: "My alerts" };
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  await requirePage(["PATIENT"]);
  return (
    <AppShell title="My alerts">
      <AlertsClient />
    </AppShell>
  );
}
