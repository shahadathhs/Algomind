import type { Metadata } from "next";
import type { ReactNode } from "react";

// The dashboard is never indexed or statically cached.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1120px] px-5 py-10 sm:px-8">{children}</div>;
}
