import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { isTheme, otherTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

describe("theme helpers", () => {
  it("recognises only light and dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("flips the theme", () => {
    expect(otherTheme("light")).toBe("dark");
    expect(otherTheme("dark")).toBe("light");
  });

  it("applies a saved choice from the init script and ignores anything else", () => {
    const run = (stored: string | null) => {
      const documentElement = { dataset: {} as Record<string, string> };
      const localStorage = {
        getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null),
      };
      runInNewContext(THEME_INIT_SCRIPT, { localStorage, document: { documentElement } });
      return documentElement.dataset.theme;
    };
    expect(run("dark")).toBe("dark");
    expect(run("light")).toBe("light");
    expect(run("purple")).toBeUndefined();
    expect(run(null)).toBeUndefined();
  });
});
