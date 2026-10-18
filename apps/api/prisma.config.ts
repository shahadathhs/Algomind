import { defineConfig } from "prisma/config";

// The URL is read here for migrate and introspection. `prisma generate` does not connect,
// so a placeholder keeps it working in CI and Docker builds without a database.
export default defineConfig({
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://algomind:algomind@localhost:5432/algomind",
  },
});
