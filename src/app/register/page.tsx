import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homePathFor } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.role));
  return (
    <AppShell title="Create your patient account">
      <RegisterForm />
    </AppShell>
  );
}
