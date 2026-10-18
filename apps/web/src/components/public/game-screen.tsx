import { BoardGraphic } from "@/components/ui/board-graphic";
import { ButtonGraphic } from "@/components/ui/button-graphic";
import { CommandIcon } from "@/components/ui/command-icon";
import { TapeGraphic } from "@/components/ui/tape-graphic";
import { TileGraphic } from "@/components/ui/tile-graphic";
import { type BoardData, COMMAND_LABEL, type Command } from "@/lib/board";
import {
  COMMAND_BUDGET,
  FAILED_BOARD,
  FAILED_PROGRAM,
  LEVEL_NUMBER,
  LEVEL_TITLE,
  READY_BOARD,
  RUNNING_BOARD,
  SOLUTION,
  SOLVED_BOARD,
} from "@/lib/sample-screens";
import { tapeFromProgram, type TapeTile } from "@/lib/tape";
import { TILE_TONE } from "@/lib/tile-variants";

export const SCREEN_WIDTH = 390;
export const SCREEN_HEIGHT = 800;

export type GameScreenState = "ready" | "running" | "failed" | "solved";

type Frame = {
  board: BoardData;
  tiles: TapeTile[];
  head?: number;
  label: string;
};

function frameFor(state: GameScreenState): Frame {
  switch (state) {
    case "ready":
      return {
        board: READY_BOARD,
        tiles: tapeFromProgram(SOLUTION.slice(0, 4), { emptySlot: "plus" }),
        label: "Game screen while building: four instructions on the tape and a Run button.",
      };
    case "running":
      return {
        board: RUNNING_BOARD,
        tiles: tapeFromProgram(SOLUTION, { current: 4 }),
        head: 4,
        label:
          "Game screen while running: the tape is under the read-head at step 5 and the automaton is on its way to the target.",
      };
    case "failed":
      return {
        board: FAILED_BOARD,
        tiles: tapeFromProgram(FAILED_PROGRAM, { current: 3, failed: true }),
        head: 3,
        label:
          "Game screen after a failed run: the automaton tried to move into a wall, the wall is striped yellow and the failing step is marked with a cross.",
      };
    case "solved":
      return {
        board: SOLVED_BOARD,
        tiles: tapeFromProgram(SOLUTION, { current: SOLUTION.length - 1, emptySlot: "plain" }),
        head: SOLUTION.length - 1,
        label: "Game screen after solving the level: 9 of 10 commands, 9 steps.",
      };
  }
}

const TEXT = { strokeWidth: 0 } as const;

function Caption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fontSize={10} letterSpacing={2} className="fill-mute" {...TEXT}>
      {children}
    </text>
  );
}

function TopBar() {
  return (
    <g>
      <TileGraphic x={20} y={22} w={40} h={40} variant="ghost" chamfer={8}>
        <CommandIcon kind="back" cx={40} cy={42} size={18} tone={TILE_TONE.ghost} />
      </TileGraphic>
      <text
        x={195}
        y={37}
        fontSize={10}
        letterSpacing={2}
        textAnchor="middle"
        className="fill-mute"
        {...TEXT}
      >
        {`LEVEL ${LEVEL_NUMBER}`}
      </text>
      <text
        x={195}
        y={62}
        fontSize={22}
        letterSpacing={0.5}
        textAnchor="middle"
        className="fill-ink"
        {...TEXT}
      >
        {LEVEL_TITLE}
      </text>
      <text x={328} y={56} fontSize={20} textAnchor="middle" className="fill-ink" {...TEXT}>
        ?
      </text>
      <g className="fill-ink" {...TEXT}>
        <rect x={346} y={44} width={22} height={3.5} />
        <rect x={346} y={51} width={22} height={3.5} />
        <rect x={346} y={58} width={22} height={3.5} />
      </g>
    </g>
  );
}

/** The row under the top bar: the goal and command count, or a plain-language result. */
function StatusRow({ state }: { state: GameScreenState }) {
  if (state === "failed" || state === "solved") {
    const failed = state === "failed";
    return (
      <g>
        <TileGraphic x={20} y={98} w={20} h={20} variant="signal" chamfer={4}>
          <CommandIcon
            kind={failed ? "fail" : "check"}
            cx={30}
            cy={108}
            size={13}
            tone={TILE_TONE.signal}
          />
        </TileGraphic>
        <text
          x={50}
          y={108}
          dy="0.35em"
          fontSize={13}
          letterSpacing={1}
          className="fill-ink"
          {...TEXT}
        >
          {failed ? "THE AUTOMATON TRIED TO MOVE INTO A" : "LEVEL SOLVED"}
        </text>
        {failed && (
          <text
            x={50}
            y={126}
            dy="0.35em"
            fontSize={13}
            letterSpacing={1}
            className="fill-ink"
            {...TEXT}
          >
            WALL
          </text>
        )}
      </g>
    );
  }
  return (
    <g>
      <text
        x={20}
        y={108}
        dy="0.35em"
        fontSize={13}
        letterSpacing={1}
        className="fill-ink"
        {...TEXT}
      >
        REACH THE TARGET
      </text>
      <text
        x={370}
        y={108}
        dy="0.35em"
        fontSize={13}
        letterSpacing={1}
        textAnchor="end"
        className="fill-mute"
        {...TEXT}
      >
        {state === "ready" ? `4 / ${COMMAND_BUDGET} COMMANDS` : `9 / ${COMMAND_BUDGET} COMMANDS`}
      </text>
    </g>
  );
}

function Commands() {
  const commands: Command[] = ["move", "left", "right"];
  return (
    <g>
      <Caption x={20} y={640}>
        COMMANDS
      </Caption>
      {commands.map((command, i) => (
        <ButtonGraphic
          key={command}
          x={20 + i * 120}
          y={650}
          w={110}
          h={50}
          label={COMMAND_LABEL[command]}
          icon={command}
          fontSize={13}
        />
      ))}
    </g>
  );
}

function Stats() {
  const stats = [
    { value: "9 / 10", label: "COMMANDS" },
    { value: "9", label: "STEPS" },
    { value: "8", label: "BEST" },
  ];
  return (
    <g>
      <Caption x={20} y={640}>
        RESULT
      </Caption>
      {stats.map((stat, i) => (
        <TileGraphic key={stat.label} x={20 + i * 120} y={650} w={110} h={50} variant="ghost">
          <text
            x={75 + i * 120}
            y={673}
            textAnchor="middle"
            fontSize={22}
            className="fill-ink"
            {...TEXT}
          >
            {stat.value}
          </text>
          <text
            x={75 + i * 120}
            y={691}
            textAnchor="middle"
            fontSize={9}
            letterSpacing={1.5}
            className="fill-mute"
            {...TEXT}
          >
            {stat.label}
          </text>
        </TileGraphic>
      ))}
    </g>
  );
}

function Controls({ state }: { state: GameScreenState }) {
  const y = 714;
  const h = 56;
  switch (state) {
    case "ready":
      return (
        <g>
          <ButtonGraphic x={20} y={y} w={96} h={h} label="STEP" icon="step" />
          <ButtonGraphic x={126} y={y} w={146} h={h} label="RUN" icon="run" primary fontSize={15} />
          <ButtonGraphic x={282} y={y} w={88} h={h} label="RESET" icon="reset" />
        </g>
      );
    case "running":
      return (
        <g>
          <ButtonGraphic x={20} y={y} w={96} h={h} label="STEP" icon="step" />
          <ButtonGraphic
            x={126}
            y={y}
            w={146}
            h={h}
            label="CONTINUE"
            icon="run"
            primary
            fontSize={15}
          />
          <ButtonGraphic x={282} y={y} w={88} h={h} label="RESET" icon="reset" />
        </g>
      );
    case "failed":
      return (
        <g>
          <ButtonGraphic x={20} y={y} w={96} h={h} label="RESET" icon="reset" />
          <ButtonGraphic x={126} y={y} w={244} h={h} label="EDIT PROGRAM" primary fontSize={15} />
        </g>
      );
    case "solved":
      return (
        <g>
          <ButtonGraphic x={20} y={y} w={96} h={h} label="LEVELS" />
          <ButtonGraphic x={126} y={y} w={110} h={h} label="REPLAY" icon="reset" />
          <ButtonGraphic x={246} y={y} w={124} h={h} label="NEXT" primary fontSize={15} />
        </g>
      );
  }
}

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
      <Caption x={20} y={516}>
        PROGRAM
      </Caption>
      <TapeGraphic tiles={frame.tiles} x={20} y={526} width={350} head={frame.head} />
      {state === "solved" ? <Stats /> : <Commands />}
      <Controls state={state} />
    </svg>
  );
}
