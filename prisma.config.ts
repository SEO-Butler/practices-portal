import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 removed automatic .env loading and no longer supports `url` in the
// schema datasource block. Importing "dotenv/config" populates process.env, and
// the connection URL for Migrate now lives here (datasource.url).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
