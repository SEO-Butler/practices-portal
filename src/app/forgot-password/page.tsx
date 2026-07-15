import { AppShell } from "@/components/shell";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AppShell title="Forgot your password?">
      <ForgotForm />
    </AppShell>
  );
}
