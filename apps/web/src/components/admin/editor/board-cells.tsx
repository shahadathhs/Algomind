"use client";

import type { LevelContent } from "@/lib/admin/admin-api";
import { boardCells, cellFacts } from "@/lib/admin/board-cells";
import type { TileState } from "@/lib/admin/tile-tools";

/**
 * The board as a grid of cells: S the start, G the goal, W a wall, the sign of a tile, and ? on
 * a cell a tile tool is waiting for.
 */
export function BoardCells({
  content,
  tileState,
  onCell,
}: {
  content: LevelContent;
  tileState: TileState;
  onCell: (x: number, y: number) => void;
}) {
  const { width, height } = content.board;
  return (
    <div
      role="group"
      aria-label="Board cells"
      className="grid max-w-[560px] gap-[2px] bg-faint p-[2px]"
      style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
    >
      {boardCells(width, height).map(([x, y]) => {
        const cell = cellFacts(content, tileState, x, y);
        return (
          <button
            key={`${x}-${y}`}
            type="button"
            aria-label={`Cell ${x + 1}, ${y + 1}: ${cell.word}`}
            onClick={() => onCell(x, y)}
            className={`flex aspect-square items-center justify-center text-[15px] font-bold outline-offset-[-4px] ${
              cell.wall
                ? "bg-wall text-on-ink"
                : cell.goal
                  ? "bg-signal text-on-signal"
                  : "bg-floor text-ink"
            } ${cell.start ? "outline-[3px] -outline-offset-[5px] outline-ink" : ""}`}
          >
            {cell.start ? "S" : cell.goal ? "G" : cell.wall ? "W" : cell.mark}
          </button>
        );
      })}
    </div>
  );
}
