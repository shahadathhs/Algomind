import { describe, expect, it } from "vitest";
import { stepLabel, tapeFromProgram } from "@/lib/tape";

describe("tapeFromProgram", () => {
  const program = ["move", "right", "move"] as const;

  it("leaves everything upcoming while editing, with a plus slot", () => {
    const tiles = tapeFromProgram(program, { emptySlot: "plus" });
    expect(tiles.map((t) => t.state)).toEqual(["upcoming", "upcoming", "upcoming", "empty"]);
    expect(tiles[3].plus).toBe(true);
    expect(tiles.map((t) => t.step)).toEqual([1, 2, 3, undefined]);
  });

  it("marks executed, current, and upcoming around the read-head", () => {
    const tiles = tapeFromProgram(program, { current: 1 });
    expect(tiles.map((t) => t.state)).toEqual(["executed", "current", "upcoming"]);
  });

  it("marks the failing tile", () => {
    const tiles = tapeFromProgram(program, { current: 2, failed: true });
    expect(tiles.map((t) => t.state)).toEqual(["executed", "executed", "failed"]);
  });
});

describe("stepLabel", () => {
  it("pads to two digits", () => {
    expect(stepLabel(5)).toBe("05");
    expect(stepLabel(12)).toBe("12");
  });
});
