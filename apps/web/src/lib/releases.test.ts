import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APK_ARCHITECTURE,
  formatFileSize,
  formatReleaseDate,
  githubApiBase,
  getLatestRelease,
  parseChecksum,
  parseRelease,
  releaseMeta,
  releaseNoteLines,
  releaseRepository,
  releasesPageUrl,
  shortHash,
  versionFromTag,
} from "@/lib/releases";

const HASH = "9f2c0d1e2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3e41a";

function releaseJson(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: "v0.1.0",
    html_url: "https://github.com/shahadathhs/Algomind/releases/tag/v0.1.0",
    draft: false,
    body: "## Changes\n- New: levels 1 to 12.\n- Fixed: tape scrolling.",
    assets: [
      {
        name: "algomind-0.1.0.apk",
        size: 24_300_000,
        browser_download_url: "https://github.com/x/y/releases/download/v0.1.0/algomind-0.1.0.apk",
      },
      {
        name: "algomind-0.1.0.apk.sha256",
        size: 100,
        browser_download_url:
          "https://github.com/x/y/releases/download/v0.1.0/algomind-0.1.0.apk.sha256",
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("releaseRepository", () => {
  it("defaults to the project repository", () => {
    delete process.env.GITHUB_REPOSITORY;
    expect(releaseRepository()).toBe("shahadathhs/Algomind");
  });

  it("uses GITHUB_REPOSITORY when it looks like owner/name", () => {
    vi.stubEnv("GITHUB_REPOSITORY", "someone/else");
    expect(releaseRepository()).toBe("someone/else");
    expect(releasesPageUrl()).toBe("https://github.com/someone/else/releases");
  });

  it("ignores a malformed value", () => {
    vi.stubEnv("GITHUB_REPOSITORY", "not a repo/../x");
    expect(releaseRepository()).toBe("shahadathhs/Algomind");
  });
});

describe("parseRelease", () => {
  it("reads the apk, the checksum asset, version, and notes", () => {
    const release = parseRelease(releaseJson());
    expect(release).toMatchObject({
      version: "0.1.0",
      tag: "v0.1.0",
      apkName: "algomind-0.1.0.apk",
      apkBytes: 24_300_000,
      checksumUrl: "https://github.com/x/y/releases/download/v0.1.0/algomind-0.1.0.apk.sha256",
      notes: ["New: levels 1 to 12.", "Fixed: tape scrolling."],
    });
    expect(release?.apkUrl.startsWith("https://")).toBe(true);
  });

  it("rejects responses that are not a usable release", () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease("nope")).toBeNull();
    expect(parseRelease([])).toBeNull();
    expect(parseRelease(releaseJson({ tag_name: "" }))).toBeNull();
    expect(parseRelease(releaseJson({ tag_name: 3 }))).toBeNull();
    expect(parseRelease(releaseJson({ html_url: "javascript:alert(1)" }))).toBeNull();
    expect(parseRelease(releaseJson({ draft: true }))).toBeNull();
    expect(parseRelease(releaseJson({ assets: [] }))).toBeNull();
    expect(parseRelease(releaseJson({ assets: "x" }))).toBeNull();
  });

  it("never links to a non-https or malformed asset", () => {
    const insecure = releaseJson({
      assets: [
        { name: "a.apk", size: 10, browser_download_url: "http://example.com/a.apk" },
        { name: "b.apk", size: 10, browser_download_url: "not a url" },
        { name: "c.apk", size: 0, browser_download_url: "https://example.com/c.apk" },
        { name: "d.apk", size: "10", browser_download_url: "https://example.com/d.apk" },
      ],
    });
    expect(parseRelease(insecure)).toBeNull();
  });

  it("works without a checksum asset or release notes", () => {
    const json = releaseJson({ body: null });
    (json.assets as unknown[]).pop();
    expect(parseRelease(json)).toMatchObject({ checksumUrl: null, notes: [] });
  });
});

describe("release date", () => {
  it("reads published_at as an ISO date, or null when missing or invalid", () => {
    const withDate = parseRelease(releaseJson({ published_at: "2026-10-18T05:22:57Z" }));
    expect(withDate?.publishedAt).toBe("2026-10-18T05:22:57.000Z");
    expect(parseRelease(releaseJson())?.publishedAt).toBeNull();
    expect(parseRelease(releaseJson({ published_at: "not a date" }))?.publishedAt).toBeNull();
    expect(parseRelease(releaseJson({ published_at: 42 }))?.publishedAt).toBeNull();
  });

  it("formats a date in UTC, and is empty for a missing or bad one", () => {
    expect(formatReleaseDate("2026-10-18T23:59:00.000Z")).toBe("18 Oct 2026");
    expect(formatReleaseDate("2026-01-05T00:00:00.000Z")).toBe("5 Jan 2026");
    expect(formatReleaseDate(null)).toBe("");
    expect(formatReleaseDate("nope")).toBe("");
  });
});

describe("githubApiBase", () => {
  it("defaults to api.github.com", () => {
    delete process.env.GITHUB_API_URL;
    expect(githubApiBase()).toBe("https://api.github.com");
  });

  it("uses GITHUB_API_URL and trims a trailing slash", () => {
    vi.stubEnv("GITHUB_API_URL", "https://github.example.com/api/v3/");
    expect(githubApiBase()).toBe("https://github.example.com/api/v3");
  });

  it("ignores an unusable value", () => {
    vi.stubEnv("GITHUB_API_URL", "not a url");
    expect(githubApiBase()).toBe("https://api.github.com");
    vi.stubEnv("GITHUB_API_URL", "ftp://example.com");
    expect(githubApiBase()).toBe("https://api.github.com");
  });

  it("is used for the release request", async () => {
    vi.stubEnv("GITHUB_API_URL", "https://stand-in.test");
    const fetchMock = vi.fn().mockResolvedValue({ status: 404, ok: false });
    vi.stubGlobal("fetch", fetchMock);
    await getLatestRelease();
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://stand-in.test/repos/shahadathhs/Algomind/releases/latest",
    );
  });
});

describe("APK_ARCHITECTURE", () => {
  it("names the architecture the Android preset builds", () => {
    expect(APK_ARCHITECTURE).toContain("arm64-v8a");
  });
});

describe("versionFromTag", () => {
  it("strips a leading v before a digit", () => {
    expect(versionFromTag("v1.2.3")).toBe("1.2.3");
    expect(versionFromTag("1.2.3")).toBe("1.2.3");
    expect(versionFromTag("latest")).toBe("latest");
  });
});

describe("parseChecksum", () => {
  it("reads a bare hash", () => {
    expect(parseChecksum(`${HASH}\n`)).toBe(HASH);
  });

  it("reads the sha256sum format and lowercases", () => {
    expect(parseChecksum(`${HASH.toUpperCase()}  algomind-0.1.0.apk\n`)).toBe(HASH);
    expect(parseChecksum(`${HASH} *algomind-0.1.0.apk`)).toBe(HASH);
  });

  it("prefers the line for the requested file", () => {
    const other = "a".repeat(64);
    expect(parseChecksum(`${other}  other.apk\n${HASH}  mine.apk\n`, "mine.apk")).toBe(HASH);
  });

  it("rejects text without a 64-character hex hash", () => {
    expect(parseChecksum("")).toBeNull();
    expect(parseChecksum("<html>Not Found</html>")).toBeNull();
    expect(parseChecksum("abc123  file.apk")).toBeNull();
    expect(parseChecksum(`${"g".repeat(64)}  file.apk`)).toBeNull();
    expect(parseChecksum(`${HASH}extra`)).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("formats kilobytes and megabytes", () => {
    expect(formatFileSize(512)).toBe("1 KB");
    expect(formatFileSize(250_000)).toBe("250 KB");
    expect(formatFileSize(1_500_000)).toBe("1.5 MB");
    expect(formatFileSize(24_300_000)).toBe("24 MB");
  });

  it("is empty for unusable sizes", () => {
    expect(formatFileSize(0)).toBe("");
    expect(formatFileSize(-1)).toBe("");
    expect(formatFileSize(Number.NaN)).toBe("");
  });
});

describe("releaseMeta", () => {
  it("lists the version and size, skipping an unknown size", () => {
    expect(releaseMeta({ version: "0.1.0", apkBytes: 24_300_000 })).toEqual([
      "Version 0.1.0",
      "24 MB",
    ]);
    expect(releaseMeta({ version: "0.1.0", apkBytes: 0 })).toEqual(["Version 0.1.0"]);
  });
});

describe("shortHash", () => {
  it("shows the first and last four characters in capitals", () => {
    expect(shortHash(HASH)).toBe("9F2C…E41A");
  });
});

describe("releaseNoteLines", () => {
  it("drops headings and markers and flattens links", () => {
    const body = "# Title\n\n* **New:** [levels](https://x.y) 1 to 12\n1. Fixed `tape`\n---\n";
    expect(releaseNoteLines(body)).toEqual(["New: levels 1 to 12", "Fixed tape"]);
  });

  it("caps the number of lines", () => {
    const body = Array.from({ length: 20 }, (_, i) => `- line ${i}`).join("\n");
    expect(releaseNoteLines(body)).toHaveLength(8);
  });
});

describe("getLatestRelease", () => {
  const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json });

  it("returns the release with its checksum when everything works", async () => {
    delete process.env.GITHUB_TOKEN;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/releases/latest")) return ok(releaseJson());
      return { ok: true, status: 200, text: async () => `${HASH}  algomind-0.1.0.apk\n` };
    });
    vi.stubGlobal("fetch", fetchMock);
    const state = await getLatestRelease();
    expect(state.status).toBe("available");
    if (state.status === "available") {
      expect(state.release.sha256).toBe(HASH);
      expect(state.release.version).toBe("0.1.0");
    }
  });

  it("keeps the release when the checksum cannot be read", async () => {
    delete process.env.GITHUB_TOKEN;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/releases/latest")) return ok(releaseJson());
        throw new Error("network down");
      }),
    );
    const state = await getLatestRelease();
    expect(state.status === "available" && state.release.sha256).toBeNull();
  });

  it("falls back when there is no release (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await getLatestRelease()).toEqual({ status: "unavailable", reason: "none" });
  });

  it("falls back when the repository is private (401 or 403)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await getLatestRelease()).toEqual({ status: "unavailable", reason: "private" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    expect(await getLatestRelease()).toEqual({ status: "unavailable", reason: "private" });
  });

  it("falls back when GitHub fails or is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await getLatestRelease()).toEqual({ status: "unavailable", reason: "error" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await getLatestRelease()).toEqual({ status: "unavailable", reason: "error" });
  });

  it("falls back on a malformed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ tag_name: "v1" })));
    expect(await getLatestRelease()).toEqual({ status: "unavailable", reason: "none" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("bad json");
        },
      }),
    );
    expect(await getLatestRelease()).toEqual({ status: "unavailable", reason: "error" });
  });

  it("treats a private repository as unavailable when a token is set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/releases/latest")) return ok(releaseJson());
      return ok({ private: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await getLatestRelease()).toEqual({ status: "unavailable", reason: "private" });
  });

  it("sends the token to the API when set, and serves a public repository", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/releases/latest")) return ok(releaseJson());
      if (url.endsWith("/Algomind")) return ok({ private: false });
      return { ok: true, status: 200, text: async () => HASH };
    });
    vi.stubGlobal("fetch", fetchMock);
    const state = await getLatestRelease();
    expect(state.status).toBe("available");
    const first = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(first[1].headers.Authorization).toBe("Bearer test-token");
    const checksumCall = fetchMock.mock.calls.at(-1) as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(checksumCall[1].headers.Authorization).toBeUndefined();
  });
});
