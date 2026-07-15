# Practices Portal

A medical practice management web app — PWA-enabled and fully responsive.

## Features

- **Patient**: self-registration, online booking, self-service personal/medical
  details, medical cases (complaints) with self-captured vitals (BP, heart
  rate, temperature, …), history of appointments, cases and vitals.
- **Receptionist**: day list, confirm bookings, check-in (assigns queue
  numbers), cancel / no-show.
- **Nurse**: nurse station with the live waiting queue and vitals capture for
  checked-in patients.
- **Doctor**: consultation queue, full case view (complaint + self and nurse
  vitals), doctor notes, start/complete consultations.
- **Practice manager**: overview stats, staff account management, plus access
  to the front desk.
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
npm run db:deploy          # apply migrations
npm run db:seed            # demo practice + accounts (optional)
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
