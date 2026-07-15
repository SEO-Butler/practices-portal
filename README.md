# Practices Portal

A medical practice management web app — PWA-enabled and fully responsive.

## Features

- **Patient**: self-registration with email verification, slot-based online
  booking, self-service personal/medical details, medical cases (complaints)
  with self-captured vitals (BP, heart rate, temperature, …), history of
  appointments, cases and vitals, in-app alerts feed.
- **Receptionist**: day list, confirm bookings, check-in (assigns queue
  numbers), cancel / no-show; patient search (name/phone/email), walk-in
  registration (offline patients or with an emailed account-claim link),
  immediate walk-in check-in and slot-validated booking on a patient's
  behalf.
- **Nurse**: nurse station with the live waiting queue and vitals capture for
  checked-in patients.
- **Doctor**: consultation queue, full case view (complaint + self and nurse
  vitals), doctor notes, start/complete consultations; clinical records per
  case — ICD-coded diagnoses, prescriptions, sick notes — plus a
  longitudinal full-history view of every past case for the patient.
- **Attachments**: patients and clinicians attach photos/documents (JPEG,
  PNG, WebP, PDF, ≤2 MB, stored in Postgres) to a case; downloads are
  access-controlled and staff views are audited.
- **Practice manager**: overview stats, staff account management (temporary
  passwords force a change on first login), doctors' weekly bookable hours,
  plus access to the front desk.
- **Slot-based booking**: patients book only into open slots generated from
  each doctor's weekly availability rules; double-booking is prevented
  transactionally and "any doctor" bookings are auto-assigned.
- **Web push (PWA)**: with VAPID keys configured (`npm run push:keygen`),
  patients enable device notifications with one tap; booking updates, queue
  alerts ("you are number N", "you're next") and reminders arrive even when
  the app is closed. Dead subscriptions are pruned automatically; sensitive
  account links (verify/reset) are never pushed.
- **Notifications via webhook**: every event (booking requested/confirmed/
  cancelled, queue check-in, "you're next", reminders, verify/reset links) is
  stored and POSTed to `WEBHOOK_URL` with an HMAC `X-Webhook-Signature` for a
  3rd-party integration to deliver as email/SMS. Without `WEBHOOK_URL`,
  events are marked *simulated* — nothing leaves the app. Appointment
  reminders run via `POST /api/jobs/reminders` (guarded by `X-Cron-Secret`),
  designed to be hit by an external cron/webhook.
- **Public waiting room** (`/waiting-room`): anonymized live queue (number,
  initials, doctor, status) — suitable for a lobby display; no sign-in needed.
- **PWA**: installable (manifest + icons), service worker with offline
  fallback; live data stays network-first.

- **Audit logging**: append-only trail (no FKs — entries outlive actors) of
  clinical chart views, all appointment/case/vitals/profile mutations and
  auth events, with actor, patient, IP and user agent. Managers browse it
  practice-scoped at `/manager/audit`.
- **Hardened sessions**: server-side revocable sessions behind the signed
  cookie (logout revokes; password change signs out other devices; reset
  signs out everywhere; "Sign out everywhere else" in account settings),
  login/reset/register rate limiting, cross-origin write rejection via
  `src/proxy.ts`, and baseline security headers.

## Stack

Next.js (App Router) · Prisma 7 + PostgreSQL · Tailwind CSS 4 · Vitest.
Auth is dependency-free: scrypt password hashes and HMAC-signed session
cookies (`src/lib/auth.ts`).

## Getting started

```bash
npm install
cp .env.example .env       # set DATABASE_URL and AUTH_SECRET
                           # optional: WEBHOOK_URL/WEBHOOK_SECRET, CRON_SECRET, APP_URL
npm run db:deploy          # apply migrations
npm run db:seed            # demo practice + accounts + doctor schedules (optional)
npm run dev
```

### Demo accounts (after `npm run db:seed`, password `Password123!`)

| Role         | Email                                  |
| ------------ | -------------------------------------- |
| Manager      | manager@demo.practicesportal.test      |
| Receptionist | reception@demo.practicesportal.test    |
| Nurse        | nurse@demo.practicesportal.test        |
| Doctor       | doctor@demo.practicesportal.test       |
| Patient      | patient@demo.practicesportal.test      |

## Scripts

- `npm test` — unit tests (auth, clinic domain rules, health)
- `npm run lint` — ESLint
- `npm run build` / `npm start` — production build & serve
- `npm run db:migrate|db:deploy|db:generate|db:seed`
- `scripts/smoke.sh <base-url>` — integration smoke test (needs a seeded DB)

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR: a checks
job (lint, unit tests, production build) and an integration job that boots
Postgres 16, applies migrations, seeds, starts the server and drives the
full clinical flow — booking conflicts, attachments, prescriptions,
role-boundary checks — via `scripts/smoke.sh`.

## Access model

Role rights for appointment transitions and clinical data live in
`src/lib/clinic.ts` (unit-tested). Reception sees demographics only; case
details and vitals are restricted to nurse/doctor/manager. The public
waiting-room API exposes queue number, initials and status — never names or
clinical data.
