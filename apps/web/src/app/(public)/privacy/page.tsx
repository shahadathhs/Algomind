import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/public/prose-page";
import { ProseSection } from "@/components/public/prose-section";

const DESCRIPTION =
  "What Algomind does and does not collect: the website sets no cookies and collects nothing, the app keeps progress on your device, and an optional account stores your email and progress.";

export const metadata: Metadata = {
  title: "Privacy",
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Algomind privacy", description: DESCRIPTION, url: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy"
      lead="Algomind collects as little as it can. This page says what is and is not collected."
    >
      <ProseSection title="This website">
        <p>
          The website collects nothing and sets no cookies. It has no analytics, no tracking, no
          advertising, and loads no third-party scripts, fonts, or images.
        </p>
        <p>
          If you use the light and dark toggle, your choice is saved in your browser on your device.
          It is never sent anywhere.
        </p>
        <p>
          Like any web host, the service that serves this site may keep standard server logs, such
          as your IP address and the page you asked for, under its own policy. The Android build is
          downloaded from GitHub Releases, so GitHub handles that download under its own policy.
        </p>
      </ProseSection>

      <ProseSection title="The app, with no account">
        <p>
          Your progress, settings, and downloaded levels are stored on your device. Playing without
          an account uploads none of it. No account is needed to play.
        </p>
        <p>
          The app asks the Algomind server for published levels so that new levels arrive without an
          app update. That request does not contain your progress.
        </p>
        <p>There are no ads and no purchases in the app.</p>
      </ProseSection>

      <ProseSection title="An optional account">
        <p>
          Accounts are optional and are not available yet. When they are, an account will store:
        </p>
        <ul>
          <li>your email address;</li>
          <li>a hash of your password, never the password itself;</li>
          <li>your progress, so it can sync between your devices.</li>
        </ul>
        <p>
          Progress is saved on your device first and is uploaded only while you are signed in. A
          failed sync never changes what is saved on your device. Nothing is sold or shared for
          advertising.
        </p>
      </ProseSection>

      <ProseSection title="Deleting your data">
        <p>
          Without an account, everything is on your device: clear the app&apos;s data or uninstall
          the app and it is gone.
        </p>
        <p>
          With an account, you will be able to delete it from the account screen in the app, which
          removes your email address and your synced progress. You can also ask for deletion by
          writing to the address on the <Link href="/contact">contact page</Link>.
        </p>
      </ProseSection>

      <ProseSection title="Changes to this page">
        <p>
          If what Algomind collects changes, this page changes first. Last updated: to be set when
          the first release is published.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
