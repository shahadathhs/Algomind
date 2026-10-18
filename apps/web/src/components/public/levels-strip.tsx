import { BoardView } from "@/components/ui/board-view";
import { Caption } from "@/components/ui/caption";
import { Section } from "@/components/ui/section";
import { TextLink } from "@/components/ui/text-link";
import { SAMPLE_LEVELS } from "@/lib/sample-levels";

export function LevelsStrip() {
  return (
    <Section id="levels">
      <Caption>Levels</Caption>
      <h2 className="mt-4 max-w-[760px] text-[32px] leading-[1.02] tracking-[0.5px] uppercase sm:text-[40px]">
        New levels arrive without an app update.
      </h2>
      <p className="mt-4 max-w-[520px] text-base leading-normal font-semibold text-mute">
        Levels are published to the game online, and downloaded levels stay playable offline.
      </p>
      <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-5">
        {SAMPLE_LEVELS.map((level, i) => (
          <li key={level.id} className={i === SAMPLE_LEVELS.length - 1 ? "hidden sm:block" : ""}>
            <BoardView
              board={level.board}
              label={`Sample level ${level.title}. Move the automaton to the target.`}
            />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <TextLink href="/levels">See all levels</TextLink>
      </div>
    </Section>
  );
}
