import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { ManagerClient } from "./manager-client";

export const metadata = { title: "Practice overview" };
export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  await requirePage(["MANAGER"]);
  return (
    <AppShell title="Practice overview">
      <ManagerClient />
    </AppShell>
  );
}
