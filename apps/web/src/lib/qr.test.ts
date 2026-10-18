import { afterEach, describe, expect, it, vi } from "vitest";
import { qrMatrix, qrPath, qrPayload } from "@/lib/qr";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("qrPayload", () => {
  it("encodes the download page, never the APK", () => {
    delete process.env.SITE_URL;
    expect(qrPayload()).toBe("https://playalgomind.vercel.app/download");
    vi.stubEnv("SITE_URL", "https://algomind.example/");
    expect(qrPayload()).toBe("https://algomind.example/download");
  });
});

describe("qrMatrix and qrPath", () => {
  it("builds a square matrix with the three finder patterns", () => {
    const m = qrMatrix("https://playalgomind.vercel.app/download");
    expect(m.size).toBeGreaterThanOrEqual(21);
    for (const [x, y] of [
      [0, 0],
      [m.size - 1, 0],
      [0, m.size - 1],
    ]) {
      expect(m.dark(x, y)).toBe(true);
    }
  });

  it("draws exactly the dark modules as path runs", () => {
    const m = qrMatrix("hello");
    const path = qrPath(m);
    expect(path.startsWith("M0 0h7v1h-7z")).toBe(true);
    let area = 0;
    for (const match of path.matchAll(/h(\d+)v1/g)) area += Number(match[1]);
    let dark = 0;
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.dark(x, y)) dark++;
    expect(area).toBe(dark);
  });
});
