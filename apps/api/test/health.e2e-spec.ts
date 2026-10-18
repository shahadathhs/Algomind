import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { setupApp } from "../src/app.setup.js";
import { PrismaService } from "../src/core/prisma/prisma.service.js";

const queryRaw = vi.fn();

describe("health (no database needed)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw, $disconnect: vi.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /v1/health is live without touching the database", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("GET /v1/health/ready is ok when the database answers", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await request(app.getHttpServer()).get("/v1/health/ready").expect(200);
    expect(res.body).toEqual({ status: "ok", database: "up" });
  });

  it("GET /v1/health/ready returns the error contract when the database is down", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const res = await request(app.getHttpServer()).get("/v1/health/ready").expect(503);
    expect(res.body).toEqual({
      statusCode: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "The database is not reachable.",
    });
  });

  it("unknown routes use the error contract too", async () => {
    const res = await request(app.getHttpServer()).get("/v1/nope").expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.statusCode).toBe(404);
  });
});
