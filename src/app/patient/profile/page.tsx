import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requirePage(["PATIENT"]);
  return (
    <AppShell title="My profile">
      <ProfileForm />
    </AppShell>
  );
}
