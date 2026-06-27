import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 requires a driver adapter at construction time; a bare
// `new PrismaClient()` throws PrismaClientInitializationError. The adapter
// reads the connection string from process.env.DATABASE_URL at runtime
// (Coolify injects it in prod; Next loads it from .env in dev), so we never
// depend on prisma.config.ts, which is for the Prisma CLI only.
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
