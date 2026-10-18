import { describe, expect, it } from "vitest";
import { chamferOutline, chamferPath, insetChamfer } from "@/lib/geometry";

describe("chamferPath", () => {
  it("cuts the top-right corner", () => {
    expect(chamferPath(0, 0, 50, 40, 10)).toBe("M0 0H40L50 10V40H0Z");
    expect(chamferPath(5, 5, 50, 40, 10)).toBe("M5 5H45L55 15V45H5Z");
  });

  it("never cuts more than the shape allows", () => {
    expect(chamferPath(0, 0, 8, 8, 50)).toBe("M0 0H0L8 8V8H0Z");
  });
});

describe("insetChamfer", () => {
  it("keeps the cut parallel for an even outline", () => {
    expect(insetChamfer(10, 2)).toBeCloseTo(8.83, 2);
    expect(insetChamfer(1, 10)).toBe(0);
  });
});

describe("chamferOutline", () => {
  it("returns an inner path inset by the outline thickness", () => {
    const { outer, inner } = chamferOutline(0, 0, 50, 40, 10, 2);
    expect(outer).toBe("M0 0H40L50 10V40H0Z");
    expect(inner.startsWith("M2 2")).toBe(true);
  });
});
