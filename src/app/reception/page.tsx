import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { ReceptionClient } from "./reception-client";

export const metadata = { title: "Front desk" };
export const dynamic = "force-dynamic";

export default async function ReceptionPage() {
  await requirePage(["RECEPTIONIST", "MANAGER"]);
  return (
    <AppShell title="Front desk">
      <ReceptionClient />
    </AppShell>
  );
}
