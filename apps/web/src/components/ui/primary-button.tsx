import type { ReactNode } from "react";

/** The one primary action on a screen: a signal-yellow tile link. */
export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="tile inline-flex h-16 items-center justify-center gap-2.5 bg-signal px-8 text-[22px] tracking-[2px] text-on-signal"
      style={{ ["--chamfer" as string]: "14px" }}
    >
      {children}
    </a>
  );
}
