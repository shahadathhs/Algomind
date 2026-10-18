import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Rule } from "@/components/ui/rule";

/** A page section: a rule above (unless it opens the page), generous spacing, one column. */
export function Section({
  id,
  rule = true,
  children,
  className = "",
}: {
  id?: string;
  rule?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <Container>
        {rule && <Rule />}
        <div className={`py-12 sm:py-[72px] ${className}`}>{children}</div>
      </Container>
    </section>
  );
}
