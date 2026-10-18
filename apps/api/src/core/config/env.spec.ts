import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("uses safe development defaults", () => {
    const env = loadEnv({});
    expect(env.nodeEnv).toBe("development");
    expect(env.port).toBe(8000);
    expect(env.databaseUrl).toContain("localhost");
    expect(env.corsOrigins).toEqual(["http://localhost:3000"]);
  });

  it("reads and splits explicit values", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      PORT: "4000",
      DATABASE_URL: "postgresql://u:p@h:5432/d",
      CORS_ORIGINS: "https://a.example, https://b.example ,",
    });
    expect(env.port).toBe(4000);
    expect(env.databaseUrl).toBe("postgresql://u:p@h:5432/d");
    expect(env.corsOrigins).toEqual(["https://a.example", "https://b.example"]);
  });

  it("requires DATABASE_URL in production", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(/DATABASE_URL is required/);
    expect(() =>
      loadEnv({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@h:5432/d" }),
    ).not.toThrow();
  });

  it("rejects an invalid port and an unknown environment", () => {
    expect(() => loadEnv({ PORT: "99999" })).toThrow(/Invalid environment/);
    expect(() => loadEnv({ NODE_ENV: "staging" })).toThrow(/Invalid environment/);
  });
});
