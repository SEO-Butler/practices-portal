import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { VitalsClient } from "./vitals-client";

export const metadata = { title: "My vitals" };
export const dynamic = "force-dynamic";

export default async function VitalsPage() {
  await requirePage(["PATIENT"]);
  return (
    <AppShell title="My vitals">
      <VitalsClient />
    </AppShell>
  );
}
