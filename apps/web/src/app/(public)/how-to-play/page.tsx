import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/public/prose-page";
import { ProseSection } from "@/components/public/prose-section";
import { BoardView } from "@/components/ui/board-view";
import { CommandTile } from "@/components/ui/command-tile";
import { TapeView } from "@/components/ui/tape-view";
import type { Command } from "@/lib/board";
import { FAILED_BOARD, READY_BOARD, SOLUTION } from "@/lib/sample-screens";
import { tapeFromProgram } from "@/lib/tape";
import { pageMetadata } from "@/lib/seo";

const DESCRIPTION =
  "How Algomind works: build a program from instruction tiles, run it, and read what happened when it fails.";

export const metadata: Metadata = pageMetadata({
  title: "How to play",
  shareTitle: "How to play Algomind",
  description: DESCRIPTION,
  path: "/how-to-play",
});

const COMMANDS: { command: Command; name: string; text: string }[] = [
  { command: "move", name: "Move", text: "Move one cell in the direction the automaton faces." },
  { command: "left", name: "Left", text: "Turn 90 degrees to the left without moving." },
  { command: "right", name: "Right", text: "Turn 90 degrees to the right without moving." },
  {
    command: "repeat",
    name: "Repeat",
    text: "Start a loop. Add commands to it, then end the loop.",
  },
];

const MESSAGES = [
  {
    message: "The automaton tried to move into a wall",
    text: "The run stopped. The wall it hit is striped yellow and the instruction that did it is marked with a cross. A move past the edge of the board counts the same way.",
  },
  {
    message: "The program ended before the goal",
    text: "Every instruction ran and the automaton is not on the target. Add instructions or change them.",
  },
  {
    message: "The program ran too long and was stopped",
    text: "Each level has a step limit so a program can never run forever. Shorten the program or change what it does.",
  },
];

export default function HowToPlayPage() {
  return (
    <ProsePage
      title="How to play"
      lead="Build a program from instruction tiles, run it, and guide the automaton to the target. There are no lives and no timers."
    >
      <ProseSection title="The board">
        <div className="max-w-[260px]">
          <BoardView
            board={READY_BOARD}
            label="A board with four walls, the automaton at the bottom left facing up, and the yellow target on the right."
          />
        </div>
        <p>
          The automaton is the dark block with a yellow wedge; the wedge shows which way it faces.
          The target is the yellow cell with a ring and a dot. Hatched cells are walls. Reach the
          target to solve the level.
        </p>
      </ProseSection>

      <ProseSection title="Commands">
        <ul className="!list-none !pl-0">
          {COMMANDS.map((item) => (
            <li key={item.command} className="flex items-center gap-4 !pl-0 pb-3">
              <CommandTile command={item.command} />
              <span>
                <strong className="block text-lg tracking-[1px] text-ink uppercase">
                  {item.name}
                </strong>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
        <p>
          Each level lists the commands you can use and the most instructions a program may hold.
          The counter above the board shows how many you have used.
        </p>
      </ProseSection>

      <ProseSection title="Loops">
        <p>
          A loop carries out the commands inside it again and again. Select its count tile to change
          how many rounds it runs. A loop uses one slot for its count and one for each command
          inside it, and the counter above the board counts slots. While a loop runs, the count tile
          shows the current round.
        </p>
      </ProseSection>

      <ProseSection title="The tape">
        <div className="max-w-[420px]">
          <TapeView
            tiles={tapeFromProgram(SOLUTION, { current: 4 })}
            head={4}
            label="A tape mid-run. Instructions already run are solid, the current one is yellow under the read-head, and the rest are outlined."
          />
        </div>
        <p>
          Your program is a strip of tiles. Tap a command to add it to the end; tap a tile to remove
          or move it. While a program runs, the strip slides under a fixed read-head.
        </p>
        <ul>
          <li>Solid tile: already run.</li>
          <li>Yellow tile: the instruction running now.</li>
          <li>Outlined tile: still to run.</li>
          <li>Dashed slot: empty, ready for a new instruction.</li>
        </ul>
        <p>The number under each tile is its step.</p>
      </ProseSection>

      <ProseSection title="Run, step, reset">
        <ul>
          <li>Run executes the program at a readable speed.</li>
          <li>Step runs one instruction at a time.</li>
          <li>Reset puts the automaton back at the start and keeps your program.</li>
        </ul>
        <p>You can edit the program again after any run.</p>
      </ProseSection>

      <ProseSection title="When a run fails">
        <div className="max-w-[260px]">
          <BoardView
            board={FAILED_BOARD}
            label="A failed run: the automaton faces a wall that is striped yellow."
          />
        </div>
        <p>A failed run always says what happened.</p>
        <ul className="!list-none !pl-0">
          {MESSAGES.map((item) => (
            <li key={item.message} className="!pl-0 pb-3">
              <strong className="block tracking-[1px] text-ink uppercase">{item.message}</strong>
              {item.text}
            </li>
          ))}
        </ul>
        <p>
          <Link href="/download">Download Algomind for Android</Link> to play.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
