import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/public/prose-page";
import { ProseSection } from "@/components/public/prose-section";

const DESCRIPTION =
  "How to reach the developer of Algomind with a bug report, a question, or a deletion request.";

export const metadata: Metadata = {
  title: "Contact",
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact Algomind", description: DESCRIPTION, url: "/contact" },
};

export default function ContactPage() {
  return (
    <ProsePage title="Contact" lead="Write to report a bug or to ask a question.">
      <ProseSection title="Email">
        {/* TODO(before launch): replace the placeholder with the real contact address. */}
        <p>
          Contact address: <strong className="text-ink">[to be filled before launch]</strong>
        </p>
        <p>
          This is a placeholder. No address has been published yet, so there is nothing to write to
          until this line is replaced.
        </p>
      </ProseSection>

      <ProseSection title="What to include">
        <ul>
          <li>The Algomind version, shown on the download page and in the app&apos;s settings.</li>
          <li>Your Android version and phone model.</li>
          <li>What you did, what you expected, and what happened instead.</li>
          <li>The level number, if the problem is in one level.</li>
        </ul>
      </ProseSection>

      <ProseSection title="Privacy and deletion">
        <p>
          To ask for your data to be deleted, write to the address above from the email address of
          the account. What is and is not collected is on the{" "}
          <Link href="/privacy">privacy page</Link>.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
