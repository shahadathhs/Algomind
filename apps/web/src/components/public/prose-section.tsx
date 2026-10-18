import type { ReactNode } from "react";

/** A titled block of body text inside a ProsePage. Paragraphs are the children. */
export function ProseSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t-2 border-ink pt-5">
      <h2 className="mb-3 text-[22px] leading-tight tracking-[1px] uppercase">{title}</h2>
      <div className="flex flex-col gap-3 text-base leading-relaxed font-semibold text-mute [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
