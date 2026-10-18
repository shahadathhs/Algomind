import type { Metadata } from "next";
import { DownloadBand } from "@/components/public/download-band";
import { WorldSection } from "@/components/public/world-section";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { TextLink } from "@/components/ui/text-link";
import { getCampaign, levelCount } from "@/lib/campaign";

const DESCRIPTION =
  "How Algomind's levels are organised: worlds that each teach one idea, chapters inside them, and the levels you unlock in order.";

export const metadata: Metadata = {
  title: "Levels",
  description: DESCRIPTION,
  alternates: { canonical: "/levels" },
  openGraph: { title: "Algomind levels", description: DESCRIPTION, url: "/levels" },
};

export default function LevelsPage() {
  const campaign = getCampaign();
  const total = campaign.worlds.reduce((sum, world) => sum + levelCount(world), 0);
  return (
    <>
      <Container className="pt-6 pb-12 sm:pb-16">
        <h1 className="text-[44px] leading-none tracking-[1px] uppercase sm:text-[56px]">
          Levels.
        </h1>
        <p className="mt-5 max-w-[620px] text-lg leading-normal font-semibold tracking-[0.5px] text-mute">
          Levels are grouped into worlds, and each world teaches one idea. A world is split into
          chapters, and you unlock the levels in order.
        </p>
        {campaign.source === "sample" && (
          <p className="mt-6 flex max-w-[680px] items-start gap-3 text-sm leading-normal font-semibold text-mute">
            <span
              className="tile inline-flex h-7 flex-none items-center bg-ink px-3 text-xs tracking-[2px] text-on-ink uppercase"
              style={{ ["--chamfer" as string]: "7px" }}
            >
              Preview
            </span>
            <span>
              These are sample levels that show how the campaign is organised. The levels you play
              are published from the dashboard and will appear here once they are released.
            </span>
          </p>
        )}
        <nav aria-label="Worlds" className="mt-8">
          <p className="text-xs font-bold tracking-[2px] text-mute uppercase">
            {`${campaign.worlds.length} worlds · ${total} levels`}
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-6">
            {campaign.worlds.map((world) => (
              <li key={world.id}>
                <TextLink href={`#world-${world.number}`}>
                  {`${String(world.number).padStart(2, "0")} ${world.title}`}
                </TextLink>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      {campaign.worlds.map((world) => (
        <Section key={world.id} id={`world-${world.number}`}>
          <WorldSection world={world} />
        </Section>
      ))}
      <DownloadBand />
    </>
  );
}
