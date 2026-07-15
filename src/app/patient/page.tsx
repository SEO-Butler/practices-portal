import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { VerifyBanner } from "@/components/verify-banner";
import { PushToggle } from "@/components/push-toggle";

export const metadata = { title: "My dashboard" };
export const dynamic = "force-dynamic";

export default async function PatientDashboard() {
  const session = await requirePage(["PATIENT"]);

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { emailVerifiedAt: true },
  });
  const patient = await prisma.patientProfile.findUnique({
    where: { userId: session.sub },
    include: {
      appointments: {
        where: { status: { in: ["REQUESTED", "CONFIRMED", "CHECKED_IN"] } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        include: {
          practice: { select: { practiceName: true } },
          doctor: { select: { title: true, firstName: true, lastName: true } },
        },
      },
      cases: { orderBy: { createdAt: "desc" }, take: 3 },
      vitals: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
  });

  if (!patient) {
    return (
      <AppShell title="My dashboard">
        <p className="text-slate-600">No patient profile found for this account.</p>
      </AppShell>
    );
  }

  const latestVitals = patient.vitals[0];

  return (
    <AppShell title={`Hello, ${patient.firstName}`}>
      {user && !user.emailVerifiedAt && <VerifyBanner />}
      <div className="mb-4 flex justify-end">
        <PushToggle />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Upcoming appointments</h2>
            <Link href="/patient/book" className="text-sm text-teal-700 underline">
              Book new
            </Link>
          </div>
          {patient.appointments.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nothing scheduled.{" "}
              <Link href="/patient/book" className="text-teal-700 underline">
                Book an appointment
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {patient.appointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {new Date(a.scheduledAt).toLocaleString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-sm text-slate-500">
                      {a.practice.practiceName ?? "Practice"}
                      {a.doctor
                        ? ` · ${a.doctor.title ? a.doctor.title + " " : ""}${a.doctor.firstName} ${a.doctor.lastName}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Latest vitals</h2>
          {latestVitals ? (
            <dl className="space-y-1 text-sm">
              {latestVitals.systolic != null && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Blood pressure</dt>
                  <dd className="font-medium">
                    {latestVitals.systolic}/{latestVitals.diastolic ?? "–"} mmHg
                  </dd>
                </div>
              )}
              {latestVitals.heartRate != null && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Heart rate</dt>
                  <dd className="font-medium">{latestVitals.heartRate} bpm</dd>
                </div>
              )}
              {latestVitals.temperatureC != null && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Temperature</dt>
                  <dd className="font-medium">{latestVitals.temperatureC} °C</dd>
                </div>
              )}
              <p className="pt-2 text-xs text-slate-400">
                Recorded {new Date(latestVitals.recordedAt).toLocaleString()}
              </p>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">No vitals recorded yet.</p>
          )}
          <Link
            href="/patient/vitals"
            className="mt-4 inline-block rounded-md border border-teal-600 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50"
          >
            Record vitals
          </Link>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent cases</h2>
            <Link href="/patient/cases" className="text-sm text-teal-700 underline">
              All cases
            </Link>
          </div>
          {patient.cases.length === 0 ? (
            <p className="text-sm text-slate-500">
              No cases yet. Feeling unwell?{" "}
              <Link href="/patient/cases" className="text-teal-700 underline">
                Describe your complaint
              </Link>{" "}
              before your visit.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {patient.cases.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{c.complaint}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Opened {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
