import type { Metadata } from "next";
import { ApkInfo } from "@/components/public/apk-info";
import { DownloadHero } from "@/components/public/download-hero";
import { InstallSteps } from "@/components/public/install-steps";
import { ReleaseAside } from "@/components/public/release-aside";
import { Container } from "@/components/ui/container";
import { Rule } from "@/components/ui/rule";
import { getLatestRelease } from "@/lib/releases";

// The page is static; the release it shows is re-read at most once an hour.
export const revalidate = 3600;

const DESCRIPTION =
  "Download the Algomind APK for Android and install it in four steps. Not on Google Play; every build is signed with the same key and published with a SHA-256.";

export const metadata: Metadata = {
  title: "Download",
  description: DESCRIPTION,
  alternates: { canonical: "/download" },
  openGraph: { title: "Download Algomind", description: DESCRIPTION, url: "/download" },
};

export default async function DownloadPage() {
  const state = await getLatestRelease();
  return (
    <>
      <DownloadHero state={state} />
      {state.status === "available" && <ApkInfo release={state.release} />}
      <Container>
        <Rule />
        <div className="grid gap-12 py-12 sm:py-[72px] lg:grid-cols-2 lg:gap-16">
          <InstallSteps />
          <ReleaseAside state={state} />
        </div>
      </Container>
    </>
  );
}
