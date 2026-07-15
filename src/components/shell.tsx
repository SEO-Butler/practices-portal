import Link from "next/link";
import { getSession } from "@/lib/session";
import { LogoutButton } from "@/components/logout-button";
import type { SessionRole } from "@/lib/auth";

const NAV: Partial<Record<SessionRole, Array<{ href: string; label: string }>>> = {
  PATIENT: [
    { href: "/patient", label: "Dashboard" },
    { href: "/patient/book", label: "Book" },
    { href: "/patient/cases", label: "My cases" },
    { href: "/patient/vitals", label: "My vitals" },
    { href: "/patient/alerts", label: "Alerts" },
    { href: "/patient/profile", label: "Profile" },
  ],
  RECEPTIONIST: [
    { href: "/reception", label: "Front desk" },
    { href: "/waiting-room", label: "Waiting room" },
  ],
  NURSE: [
    { href: "/nurse", label: "Nurse station" },
    { href: "/waiting-room", label: "Waiting room" },
  ],
  DOCTOR: [
    { href: "/doctor", label: "Consultations" },
    { href: "/waiting-room", label: "Waiting room" },
  ],
  MANAGER: [
    { href: "/manager", label: "Overview" },
    { href: "/reception", label: "Front desk" },
    { href: "/manager/audit", label: "Audit log" },
    { href: "/waiting-room", label: "Waiting room" },
  ],
};

export async function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const session = await getSession();
  const links = session ? (NAV[session.role] ?? []) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-teal-700">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-white">
              +
            </span>
            <span className="hidden sm:inline">Practices Portal</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-slate-600 hover:bg-teal-50 hover:text-teal-700"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {session ? (
            <LogoutButton />
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}
