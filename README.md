# Practices Portal

A medical practice management web app — PWA-enabled and fully responsive.

## Features

- **Patient**: self-registration with email verification, slot-based online
  booking, self-service personal/medical details, medical cases (complaints)
  with self-captured vitals (BP, heart rate, temperature, …), history of
  appointments, cases and vitals, in-app alerts feed.
- **Receptionist**: day list, confirm bookings, check-in (assigns queue
  numbers), cancel / no-show.
- **Nurse**: nurse station with the live waiting queue and vitals capture for
  checked-in patients.
- **Doctor**: consultation queue, full case view (complaint + self and nurse
  vitals), doctor notes, start/complete consultations.
- **Practice manager**: overview stats, staff account management (temporary
  passwords force a change on first login), doctors' weekly bookable hours,
  plus access to the front desk.
- **Slot-based booking**: patients book only into open slots generated from
  each doctor's weekly availability rules; double-booking is prevented
  transactionally and "any doctor" bookings are auto-assigned.
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

## Access model

Role rights for appointment transitions and clinical data live in
`src/lib/clinic.ts` (unit-tested). Reception sees demographics only; case
details and vitals are restricted to nurse/doctor/manager. The public
waiting-room API exposes queue number, initials and status — never names or
clinical data.
