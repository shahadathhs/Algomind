import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Algomind", template: "%s · Algomind" },
  description: "A programming puzzle for Android. Offline first. No ads. No purchases.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ground text-ink">{children}</body>
    </html>
  );
}
