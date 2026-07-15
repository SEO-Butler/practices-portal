import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homePathFor } from "@/lib/auth";
import { AppShell } from "@/components/shell";

export default async function Home() {
  const session = await getSession();
  if (session && session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect(homePathFor(session.role));
  }

  return (
    <AppShell title="Welcome">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
          <h2 className="text-xl font-semibold">
            Your practice, in your pocket
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Book appointments online, keep your personal and medical details up
            to date, log your own vitals, and see live waiting-room status —
            all from any device. Installable as an app.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-md bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
            >
              Create patient account
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-teal-600 px-4 py-2 font-medium text-teal-700 hover:bg-teal-50"
            >
              Sign in
            </Link>
          </div>
        </section>

        <Link
          href="/waiting-room"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-400"
        >
          <h3 className="font-semibold">Live waiting room</h3>
          <p className="mt-1 text-sm text-slate-600">
            See the current queue at your practice — no sign-in needed.
          </p>
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold">For practice teams</h3>
          <p className="mt-1 text-sm text-slate-600">
            Receptionists manage the day list and check-ins, nurses capture
            vitals, doctors run consultations, and managers oversee staff and
            stats. Sign in with your staff account.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
