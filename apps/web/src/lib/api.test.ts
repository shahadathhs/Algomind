import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, readApiStatus } from "@/lib/api";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("apiBaseUrl", () => {
  it("defaults to the local API", () => {
    vi.stubEnv("API_BASE_URL", "");
    // An empty variable is still "set"; the default applies only when it is undefined.
    delete process.env.API_BASE_URL;
    expect(apiBaseUrl()).toBe("http://localhost:8000/v1");
  });

  it("uses API_BASE_URL and trims a trailing slash", () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.com/v1/");
    expect(apiBaseUrl()).toBe("https://api.example.com/v1");
  });
});

describe("readApiStatus", () => {
  it("is ready when the API answers 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_BASE_URL", "http://api.test/v1");
    expect(await readApiStatus()).toEqual({ reachable: true, database: true });
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/health/ready");
  });

  it("reports the database down when readiness fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await readApiStatus()).toEqual({ reachable: true, database: false });
  });

  it("never throws when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
    expect(await readApiStatus()).toEqual({ reachable: false, database: false });
  });
});
