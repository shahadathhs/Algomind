import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: z
    .string({ error: "is required (run `make env` for local development)" })
    .min(1, "is required (run `make env` for local development)"),
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
  return {
    nodeEnv: NODE_ENV,
    port: PORT,
    databaseUrl: DATABASE_URL,
    corsOrigins: CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
