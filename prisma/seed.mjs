// Demo seed: one approved practice with a full team and a demo patient.
// Plain ESM so it runs with `node prisma/seed.mjs` (no ts runner needed).
// Requires DATABASE_URL in the environment.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { scryptSync, randomBytes } from "node:crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Same format as src/lib/auth.ts hashPassword().
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

const PASSWORD = "Password123!";

async function upsertUser(email, role, extras = {}) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      role,
      passwordHash: hashPassword(PASSWORD),
      emailVerifiedAt: new Date(),
      ...extras,
    },
  });
}

async function main() {
  const owner = await upsertUser("owner@demo.practicesportal.test", "OWNER");

  const practice = await prisma.practice.upsert({
    where: { publicId: "demo-family-clinic" },
    update: { status: "APPROVED" },
    create: {
      publicId: "demo-family-clinic",
      ownerId: owner.id,
      status: "APPROVED",
      region: "Khomas",
      practiceName: "Demo Family Clinic",
      doctorName: "Dr Naledi Amupolo",
      specialty: "General practice",
      phone: "+264 61 000 000",
      email: "reception@demo.practicesportal.test",
      address: "12 Independence Ave, Windhoek",
      hours: "Mon–Fri 08:00–17:00, Sat 08:00–12:00",
      about: "Family medicine, chronic care and minor procedures.",
      approvedAt: new Date(),
    },
  });

  const staff = [
    ["manager@demo.practicesportal.test", "MANAGER", "Paulus", "Shikongo", null, null],
    ["reception@demo.practicesportal.test", "RECEPTIONIST", "Maria", "Garises", null, null],
    ["nurse@demo.practicesportal.test", "NURSE", "Johanna", "Iipinge", "Sr", null],
    ["doctor@demo.practicesportal.test", "DOCTOR", "Naledi", "Amupolo", "Dr", "General practice"],
    ["doctor2@demo.practicesportal.test", "DOCTOR", "Erik", "Louw", "Dr", "Pediatrics"],
  ];

  const staffProfiles = {};
  for (const [email, role, firstName, lastName, title, specialty] of staff) {
    const user = await upsertUser(email, role);
    staffProfiles[email] = await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        practiceId: practice.id,
        firstName,
        lastName,
        title,
        specialty,
      },
    });
  }

  // Weekly bookable hours: Dr Amupolo Mon–Fri 08:00–17:00 (30-min slots),
  // Dr Louw Mon–Fri 08:00–13:00 (20-min slots).
  const schedules = [
    ["doctor@demo.practicesportal.test", 8 * 60, 17 * 60, 30],
    ["doctor2@demo.practicesportal.test", 8 * 60, 13 * 60, 20],
  ];
  for (const [email, startMinute, endMinute, slotMinutes] of schedules) {
    const doctor = staffProfiles[email];
    const existing = await prisma.availabilityRule.count({
      where: { doctorId: doctor.id },
    });
    if (existing === 0) {
      await prisma.availabilityRule.createMany({
        data: [1, 2, 3, 4, 5].map((weekday) => ({
          doctorId: doctor.id,
          weekday,
          startMinute,
          endMinute,
          slotMinutes,
        })),
      });
    }
  }

  const patientUser = await upsertUser("patient@demo.practicesportal.test", "PATIENT");
  await prisma.patientProfile.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: {
      userId: patientUser.id,
      firstName: "Anna",
      lastName: "Mbeki",
      phone: "+264 81 234 5678",
      allergies: "Penicillin",
    },
  });

  console.log("Seed complete. Demo accounts (password: %s):", PASSWORD);
  for (const [email, role] of [
    ...staff.map(([e, r]) => [e, r]),
    ["patient@demo.practicesportal.test", "PATIENT"],
  ]) {
    console.log("  %s  %s", role.padEnd(12), email);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
