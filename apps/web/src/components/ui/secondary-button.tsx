import Link from "next/link";
import type { ReactNode } from "react";

/** A secondary action: an outlined tile with the top-right corner cut. */
export function SecondaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="tile inline-flex bg-ink p-[2px] tracking-[2px] uppercase transition-transform duration-100 active:translate-y-px"
      style={{ ["--chamfer" as string]: "12px" }}
    >
      <span
        className="tile flex h-14 items-center bg-ground px-6 text-base"
        style={{ ["--chamfer" as string]: "10.6px" }}
      >
        {children}
      </span>
    </Link>
  );
}
