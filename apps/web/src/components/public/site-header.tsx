import { Wordmark } from "@/components/ui/wordmark";

export function SiteHeader() {
  return (
    <header className="mx-auto flex h-[84px] max-w-[1120px] items-center justify-between px-5 sm:px-8">
      <a href="/" aria-label="Algomind home">
        <Wordmark />
      </a>
      <nav className="flex items-center gap-7 text-sm tracking-[2px]">
        <a href="/download">DOWNLOAD</a>
      </nav>
    </header>
  );
}
