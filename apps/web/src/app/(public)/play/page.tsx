import type { Metadata } from "next";
import { PlayFrame } from "@/components/public/play-frame";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { readPlayBuild } from "@/lib/play-build";
import { pageMetadata } from "@/lib/seo";

const DESCRIPTION =
  "Try Algomind in your browser. It is the same game as the Android app, running from its web export.";

export const metadata: Metadata = pageMetadata({
  title: "Play in your browser",
  shareTitle: "Play Algomind in your browser",
  description: DESCRIPTION,
  path: "/play",
});

export default function PlayPage() {
  const build = readPlayBuild();
  return (
    <Container className="pt-6 pb-16 sm:pb-24">
      <div className="max-w-[680px]">
        <h1 className="text-[40px] leading-none tracking-[1px] uppercase sm:text-[56px]">
          Play in your browser
        </h1>
        <p className="mt-5 text-lg leading-normal font-semibold tracking-[0.3px] text-mute">
          The same game as the Android app, from its web export. Progress stays in this browser. The
          app is the better way to play.
        </p>
      </div>
      <div className="mt-10 max-w-[430px]">
        {build.available ? (
          <PlayFrame executable={build.executable} sizes={build.sizes} />
        ) : (
          <p role="status" className="text-base font-semibold text-mute">
            The browser version is not available right now.
          </p>
        )}
        <noscript>
          <p className="mt-4 text-base font-semibold text-mute">
            The browser version needs JavaScript.
          </p>
        </noscript>
      </div>
      <div className="mt-8 flex flex-wrap gap-x-8">
        <TextLink href="/download">Download for Android</TextLink>
        <TextLink href="/how-to-play">How to play</TextLink>
      </div>
    </Container>
  );
}
