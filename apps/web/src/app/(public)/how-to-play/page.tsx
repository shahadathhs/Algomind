import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/public/prose-page";
import { ProseSection } from "@/components/public/prose-section";
import { BoardView } from "@/components/ui/board-view";
import { CommandTile } from "@/components/ui/command-tile";
import { TapeView } from "@/components/ui/tape-view";
import type { Command } from "@/lib/board";
import { FAILED_BOARD, READY_BOARD, RUNNING_STEP, SOLUTION } from "@/lib/sample-screens";
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
  {
    command: "until",
    name: "Repeat until",
    text: "Start a loop that runs until a wall or the edge of the board is straight ahead, or until the goal is reached.",
  },
  {
    command: "if",
    name: "If",
    text: "Look at the cell on one side. Run the commands under then if it is open, and the commands under else if it is not.",
  },
  {
    command: "proc",
    name: "Procedure",
    text: "Define a named group of commands, A, B or C. It does not run where it stands.",
  },
  {
    command: "call",
    name: "Call",
    text: "Run a procedure you defined, then carry on with the next command.",
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
      wide
      title="How to play"
      lead="Build a program from instruction tiles, run it, and guide the automaton to the target. There are no lives and no timers."
    >
      <ProseSection
        title="The board"
        figure={
          <BoardView
            board={READY_BOARD}
            label="A board with a wall of three cells, the automaton at the bottom right facing up, and the yellow target just above the wall."
          />
        }
      >
        <p>
          The automaton is the dark block with a yellow wedge; the wedge shows which way it faces.
          The target is the yellow cell with a ring and a dot. Hatched cells are walls. Reach the
          target to solve the level.
        </p>
      </ProseSection>

      <ProseSection title="Commands" spread>
        <ul className="!list-none !pl-0 lg:grid lg:grid-cols-2 lg:gap-x-12">
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
        <p>
          A repeat until loop has no count. Before each round it looks at the cell straight ahead.
          If that cell is a wall or off the board, the loop ends. Otherwise the commands inside run
          once more. A loop that starts facing a wall runs none of them. It uses the same slots as
          any other loop, and it works for a corridor of any length.
        </p>
      </ProseSection>

      <ProseSection title="If and sensors">
        <p>
          An if block makes a decision. It has a sensor: clear ahead, clear left or clear right. The
          sensor is true when the cell on that side is on the board and is not a wall. Reading it
          costs no step. If it is true, the commands under then run. If it is not, the commands
          under else run, and else may be empty.
        </p>
        <p>
          An if block uses one slot, plus one for each command in then and in else. It can stand on
          its own or inside a loop, but not inside another if block. A repeat until loop can also
          wait for the goal, which keeps a program with decisions going until it arrives.
        </p>
      </ProseSection>

      <ProseSection title="Procedures">
        <p>
          A procedure is a named group of commands, A, B or C. You define it once and call it from
          several places, so a shape that comes back along the route is written only once. A
          definition does not run where it stands. Each call runs the commands of that procedure and
          then the program goes on.
        </p>
        <p>
          A call uses one slot. A definition uses one slot plus one for each command in it. A
          procedure can hold moves, turns, if blocks and loops, but not a call to another procedure.
          A call can stand on its own or inside a loop.
        </p>
      </ProseSection>

      <ProseSection
        title="The tape"
        figure={
          <TapeView
            tiles={tapeFromProgram(SOLUTION, { current: RUNNING_STEP })}
            head={RUNNING_STEP}
            label="A tape mid-run. Instructions already run are solid, the current one is yellow under the read-head, and the rest are outlined."
          />
        }
      >
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

      <ProseSection
        title="When a run fails"
        figure={
          <BoardView
            board={FAILED_BOARD}
            label="A failed run: the automaton faces a wall that is striped yellow."
          />
        }
      >
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
