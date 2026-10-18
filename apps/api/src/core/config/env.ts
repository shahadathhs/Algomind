import { z } from "zod";

const DEV_DATABASE_URL = "postgresql://algomind:algomind@localhost:5432/algomind";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
});

export type Env = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
};

/** Parses and validates the environment. Throws a readable error on bad configuration. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  const { NODE_ENV, PORT, DATABASE_URL, CORS_ORIGINS } = parsed.data;
  if (NODE_ENV === "production" && !DATABASE_URL) {
    throw new Error("Invalid environment: DATABASE_URL is required in production");
  }
  return {
    nodeEnv: NODE_ENV,
    port: PORT,
    databaseUrl: DATABASE_URL ?? DEV_DATABASE_URL,
    corsOrigins: CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
