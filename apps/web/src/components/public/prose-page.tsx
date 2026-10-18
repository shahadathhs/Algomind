import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/** A plain text page: a heading, a short lead, and sections in one readable column. */
export function ProsePage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <Container className="pt-6 pb-16 sm:pb-24">
      <div className="max-w-[680px]">
        <h1 className="text-[40px] leading-none tracking-[1px] uppercase sm:text-[56px]">
          {title}
        </h1>
        {lead && (
          <p className="mt-5 text-lg leading-normal font-semibold tracking-[0.3px] text-mute">
            {lead}
          </p>
        )}
        <div className="mt-10 flex flex-col gap-10">{children}</div>
      </div>
    </Container>
  );
}
