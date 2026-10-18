import type { Metadata } from "next";
import { JsonLd } from "@/components/public/json-ld";
import { DownloadBand } from "@/components/public/download-band";
import { Hero } from "@/components/public/hero";
import { HowItWorks } from "@/components/public/how-it-works";
import { LevelsStrip } from "@/components/public/levels-strip";
import { ScreensSection } from "@/components/public/screens-section";
import { ShortList } from "@/components/public/short-list";
import { getLatestRelease } from "@/lib/releases";
import { mobileApplicationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Algomind: a programming puzzle for Android",
  absoluteTitle: true,
  shareTitle: "Algomind",
  description:
    "Build a program from instruction tiles, run it, and guide the automaton to the target. Free for Android. Offline first. No ads. No purchases.",
  path: "/",
});

export default async function LandingPage() {
  const release = await getLatestRelease();
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd
        data={mobileApplicationJsonLd(release.status === "available" ? release.release : undefined)}
      />
      <Hero release={release} />
      <HowItWorks />
      <ScreensSection />
      <LevelsStrip />
      <ShortList />
      <DownloadBand />
    </>
  );
}
