import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Appointment-reminder job. Designed to be triggered by an external webhook
 * or cron (POST with X-Cron-Secret when CRON_SECRET is configured). Sends a
 * reminder for every REQUESTED/CONFIRMED appointment starting within the
 * next 24 hours that hasn't been reminded yet.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const due = await prisma.appointment.findMany({
    where: {
      status: { in: ["REQUESTED", "CONFIRMED"] },
      scheduledAt: { gte: now, lte: horizon },
      reminderSentAt: null,
    },
    take: 100,
    include: {
      practice: { select: { practiceName: true } },
      patient: { select: { user: { select: { id: true, email: true } } } },
      doctor: { select: { title: true, firstName: true, lastName: true } },
    },
  });

  let sent = 0;
  for (const appt of due) {
    // Mark first so a crashed run can't double-send.
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSentAt: new Date() },
    });
    await notify({
      userId: appt.patient.user.id,
      type: "BOOKING_REMINDER",
      channel: "EMAIL",
      recipient: appt.patient.user.email,
      title: "Appointment reminder",
      body: `Reminder: your appointment at ${appt.practice.practiceName ?? "the practice"} is on ${appt.scheduledAt.toLocaleString()}${
        appt.doctor
          ? ` with ${appt.doctor.title ? appt.doctor.title + " " : ""}${appt.doctor.firstName} ${appt.doctor.lastName}`
          : ""
      }.`,
      data: { appointmentId: appt.id },
    });
    sent++;
  }

  return NextResponse.json({ sent });
}
