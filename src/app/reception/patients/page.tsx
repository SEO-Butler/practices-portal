import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { PatientsClient } from "./patients-client";

export const metadata = { title: "Patients" };
export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  await requirePage(["RECEPTIONIST", "MANAGER"]);
  return (
    <AppShell title="Patients & walk-ins">
      <PatientsClient />
    </AppShell>
  );
}
