import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { DoctorClient } from "./doctor-client";

export const metadata = { title: "Consultations" };
export const dynamic = "force-dynamic";

export default async function DoctorPage() {
  await requirePage(["DOCTOR", "MANAGER"]);
  return (
    <AppShell title="Consultations">
      <DoctorClient />
    </AppShell>
  );
}
