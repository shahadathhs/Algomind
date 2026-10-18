import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("defaults to the live site", () => {
    delete process.env.SITE_URL;
    expect(siteUrl()).toBe("https://playalgomind.vercel.app");
  });

  it("uses SITE_URL and trims a trailing slash", () => {
    vi.stubEnv("SITE_URL", "https://algomind.example/");
    expect(siteUrl()).toBe("https://algomind.example");
  });
});
