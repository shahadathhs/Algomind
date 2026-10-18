import type { Metadata } from "next";
import { DownloadBand } from "@/components/public/download-band";
import { Hero } from "@/components/public/hero";
import { HowItWorks } from "@/components/public/how-it-works";
import { LevelsStrip } from "@/components/public/levels-strip";
import { ScreensSection } from "@/components/public/screens-section";
import { ShortList } from "@/components/public/short-list";
import { getLatestRelease } from "@/lib/releases";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Algomind: a programming puzzle for Android" },
  description:
    "Build a program from instruction tiles, run it, and guide the automaton to the target. Free for Android. Offline first. No ads. No purchases.",
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function LandingPage() {
  const release = await getLatestRelease();
  return (
    <>
      <Hero release={release} />
      <HowItWorks />
      <ScreensSection />
      <LevelsStrip />
      <ShortList />
      <DownloadBand />
    </>
  );
}
