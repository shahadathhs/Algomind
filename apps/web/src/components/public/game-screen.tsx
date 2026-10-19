import { BoardGraphic } from "@/components/ui/board-graphic";
import { TapeGraphic } from "@/components/ui/tape-graphic";
import { Commands } from "./game-screen/commands";
import { Controls } from "./game-screen/controls";
import { frameFor } from "./game-screen/frames";
import { StatusRow } from "./game-screen/status-row";
import { Stats } from "./game-screen/stats";
import { SvgCaption } from "./game-screen/svg-text";
import { TopBar } from "./game-screen/top-bar";

export const SCREEN_WIDTH = 390;
export const SCREEN_HEIGHT = 800;

export type GameScreenState = "ready" | "running" | "failed" | "solved";

/**
 * A game screen drawn as one SVG (390 by 800 units) from the same parts the real renderer uses:
 * board, tape, command tiles, and buttons. Shown flat, never inside a device bezel.
 */
export function GameScreen({ state, className }: { state: GameScreenState; className?: string }) {
  const frame = frameFor(state);
  return (
    <svg
      viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}
      role="img"
      aria-label={frame.label}
      className={className ?? "block h-auto w-full"}
    >
      <TopBar />
      <StatusRow state={state} />
      <BoardGraphic board={frame.board} x={20} y={136} size={350} />
      <SvgCaption x={20} y={516}>
        PROGRAM
      </SvgCaption>
      <TapeGraphic tiles={frame.tiles} x={20} y={526} width={350} head={frame.head} />
      {state === "solved" ? <Stats /> : <Commands />}
      <Controls state={state} />
    </svg>
  );
}
