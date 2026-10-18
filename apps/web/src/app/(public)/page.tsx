import { PrimaryButton } from "@/components/ui/primary-button";

// Placeholder landing page. The real sections are specified in docs/README_WEB_PLAN.md.
export default function LandingPage() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8">
      <div className="mb-4 text-xs tracking-[2px] text-mute">ANDROID</div>
      <h1 className="max-w-[640px] text-[44px] leading-none tracking-[1px] sm:text-[64px]">
        A PROGRAMMING PUZZLE FOR ANDROID.
      </h1>
      <p className="mt-6 mb-8 max-w-[520px] text-lg leading-normal font-semibold tracking-[0.5px] text-mute">
        Build a program from instruction tiles, run it, and guide the automaton to the target.
        Offline first. No ads. No purchases.
      </p>
      <PrimaryButton href="/download">DOWNLOAD FOR ANDROID</PrimaryButton>
      <p className="mt-6 text-xs tracking-[2px] text-mute">PLACEHOLDER PAGE</p>
    </section>
  );
}
