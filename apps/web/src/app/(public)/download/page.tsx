import type { Metadata } from "next";

export const metadata: Metadata = { title: "Download" };

// Placeholder. The release data, QR code, and install steps are specified in docs/README_WEB_PLAN.md.
export default function DownloadPage() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8">
      <div className="mb-4 text-xs tracking-[2px] text-mute">ANDROID</div>
      <h1 className="text-[44px] leading-none tracking-[1px] sm:text-[56px]">DOWNLOAD ALGOMIND.</h1>
      <p className="mt-6 max-w-[520px] text-lg leading-normal font-semibold text-mute">
        There is no release yet. Builds will be published on this page.
      </p>
    </section>
  );
}
