"use client";

import { useState } from "react";
import { BoardView } from "@/components/ui/board-view";
import { Caption } from "@/components/ui/caption";
import {
  addBoard,
  boardCount,
  editBoard,
  MAX_BOARDS,
  onBoard,
  removeBoard,
} from "@/lib/admin/board-model";
import { applyTool, resizeBoard, type Tool } from "@/lib/admin/board-tools";
import {
  NO_TILE_STATE,
  type TileState,
  type TileTool,
  applyTileTool,
} from "@/lib/admin/tile-tools";
import { GOAL_LABELS, isSweep, setGoalType } from "@/lib/admin/goal-model";
import {
  BOARD_MAX,
  BOARD_MIN,
  boardData,
  DIRECTIONS,
  type Direction,
} from "@/lib/admin/level-model";
import { Field, OutlineAction, SelectField } from "../ui";
import { BoardCells } from "./board-cells";
import { BoardTabs } from "./board-tabs";
import { TileToolbox } from "./tile-toolbox";
import type { ContentProps } from "./content-props";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "wall", label: "Wall" },
  { id: "floor", label: "Floor" },
  { id: "start", label: "Start" },
  { id: "goal", label: "Goal" },
];

export function BoardPanel({ content: level, onChange: onLevelChange }: ContentProps) {
  const [tool, setTool] = useState<Tool>("wall");
  const [tileTool, setTileTool] = useState<TileTool | null>(null);
  const [tileState, setTileState] = useState<TileState>(NO_TILE_STATE);
  const [picked, setPicked] = useState(0);
  const count = boardCount(level);
  const index = Math.min(picked, count - 1);
  // Everything below edits the selected board as if it were the level's only one.
  const content = onBoard(level, index);
  const onChange = (next: typeof content) => onLevelChange(editBoard(level, index, () => next));
  const { width, height } = content.board;
  const sweep = isSweep(content.goal);
  const tools = sweep ? TOOLS.filter((t) => t.id !== "goal") : TOOLS;
  const activeTool = tools.some((t) => t.id === tool) ? tool : "wall";
  const clickCell = (x: number, y: number) => {
    if (tileTool && count === 1) {
      // Tiles are not part of a board's own fields, so the whole level changes.
      const result = applyTileTool(level, tileTool, x, y, tileState);
      setTileState(result.state);
      if (result.content !== level) onLevelChange(result.content);
      return;
    }
    onChange(applyTool(content, activeTool, x, y));
  };
  /** Arrow keys move between the tools, as in any radio group. */
  function moveTool(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const next = tools[(index + step + tools.length) % tools.length]!;
    setTool(next.id);
    (
      e.currentTarget.parentElement?.children[tools.indexOf(next)] as HTMLElement | undefined
    )?.focus();
  }
  return (
    <div>
      <BoardTabs count={count} selected={index} onSelect={setPicked} />
      <div className="mb-6 flex flex-wrap gap-3">
        <OutlineAction
          type="button"
          disabled={count >= MAX_BOARDS}
          onClick={() => {
            onLevelChange(addBoard(level, index));
            setPicked(count);
          }}
        >
          Add board (copy of board {index + 1})
        </OutlineAction>
        <OutlineAction
          type="button"
          disabled={count >= MAX_BOARDS}
          onClick={() => {
            onLevelChange(addBoard(level, null));
            setPicked(count);
          }}
        >
          Add empty board
        </OutlineAction>
        <OutlineAction
          type="button"
          disabled={index === 0}
          onClick={() => {
            onLevelChange(removeBoard(level, index));
            setPicked(index - 1);
          }}
        >
          Remove board {index + 1}
        </OutlineAction>
      </div>
      {count > 1 && (
        <p className="mb-4 text-sm font-semibold text-mute">
          {count} boards. One program must solve every board.
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div role="radiogroup" aria-label="Board tool" className="mb-4 flex flex-wrap gap-3">
            {tools.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={activeTool === t.id && !tileTool}
                tabIndex={activeTool === t.id ? 0 : -1}
                onClick={() => {
                  setTool(t.id);
                  setTileTool(null);
                  setTileState(NO_TILE_STATE);
                }}
                onKeyDown={(e) => moveTool(e, i)}
                className={`tile inline-flex h-11 items-center px-5 text-[13px] tracking-[2px] uppercase ${
                  activeTool === t.id && !tileTool ? "bg-ink text-on-ink" : "bg-strip text-ink"
                }`}
                style={{ ["--chamfer" as string]: "10px" }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <BoardCells content={content} tileState={tileState} onCell={clickCell} />
          <TileToolbox
            content={level}
            tool={tileTool}
            onTool={setTileTool}
            state={tileState}
            onState={setTileState}
            onChange={onLevelChange}
            disabled={count > 1}
          />
          <p className="mt-3 text-sm font-semibold text-mute">
            {sweep
              ? "Pick a tool, then select cells. S marks the start, W a wall. The run succeeds when every floor cell has been entered."
              : "Pick a tool, then select cells. S marks the start, G the goal, W a wall. Tiles: ~ ice, arrows belts, k key, d door, c crate, b dock, s switch, g gate, o teleporter, x guard route."}
          </p>
        </div>
        <div className="grid content-start gap-5">
          <Field
            label={`Width (${BOARD_MIN} to ${BOARD_MAX})`}
            id="ed-width"
            type="number"
            min={BOARD_MIN}
            max={BOARD_MAX}
            value={width}
            onChange={(e) =>
              onChange(resizeBoard(content, Number(e.target.value) || BOARD_MIN, height))
            }
          />
          <Field
            label={`Height (${BOARD_MIN} to ${BOARD_MAX})`}
            id="ed-height"
            type="number"
            min={BOARD_MIN}
            max={BOARD_MAX}
            value={height}
            onChange={(e) =>
              onChange(resizeBoard(content, width, Number(e.target.value) || BOARD_MIN))
            }
          />
          <SelectField
            label="Goal"
            id="ed-goal-type"
            value={content.goal.type}
            onChange={(e) => onChange(setGoalType(content, e.target.value))}
          >
            {Object.entries(GOAL_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Start facing"
            id="ed-facing"
            value={content.initialState.direction}
            onChange={(e) =>
              onChange({
                ...content,
                initialState: { ...content.initialState, direction: e.target.value as Direction },
              })
            }
          >
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d[0]!.toUpperCase() + d.slice(1)}
              </option>
            ))}
          </SelectField>
          <div>
            <Caption className="mb-2">Board</Caption>
            <BoardView board={boardData(content)} label="Preview of the board as players see it." />
          </div>
        </div>
      </div>
    </div>
  );
}
