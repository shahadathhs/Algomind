import { BoardGraphic } from "@/components/ui/board-graphic";
import { type BoardData, describeBoard } from "@/lib/board";

const SIZE = 350;

/**
 * A standalone board as an inline SVG that scales to its container's width. Reused by the public
 * pages and, later, the dashboard preview and level pages.
 */
export function BoardView({
  board,
  label,
  className = "block h-auto w-full",
}: {
  board: BoardData;
  /** Accessible name; defaults to a description of the board. */
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label ?? describeBoard(board)}
      className={className}
    >
      <BoardGraphic board={board} size={SIZE} />
    </svg>
  );
}
