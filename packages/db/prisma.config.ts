import { defineConfig } from "prisma/config";

/**
 * Migrations use a direct connection when one is set, because Neon's pooled
 * endpoint is not suitable for them. `process.env` rather than Prisma's `env()`
 * helper, which throws when a variable is missing: `prisma generate` runs on
 * every install and has no need for a database.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
