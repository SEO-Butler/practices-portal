import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homePathFor } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.role));
  return (
    <AppShell title="Sign in">
      <LoginForm />
    </AppShell>
  );
}
