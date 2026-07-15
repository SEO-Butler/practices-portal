import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { CasesClient } from "./cases-client";

export const metadata = { title: "My cases" };
export const dynamic = "force-dynamic";

export default async function CasesPage() {
  await requirePage(["PATIENT"]);
  return (
    <AppShell title="My medical cases">
      <CasesClient />
    </AppShell>
  );
}
