import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { NurseClient } from "./nurse-client";

export const metadata = { title: "Nurse station" };
export const dynamic = "force-dynamic";

export default async function NursePage() {
  await requirePage(["NURSE", "MANAGER"]);
  return (
    <AppShell title="Nurse station">
      <NurseClient />
    </AppShell>
  );
}
