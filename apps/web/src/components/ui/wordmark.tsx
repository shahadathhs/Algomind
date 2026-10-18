const LETTERS = ["A", "L", "G", "O", "M", "I", "N", "D"];

/** The ALGOMIND wordmark: eight tiles, the first one signal yellow. */
export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-[30px] w-[22px] text-[18px]" : "h-[34px] w-[26px] text-[22px]";
  return (
    <span aria-label="Algomind" role="img" className="inline-flex gap-[3px]">
      {LETTERS.map((letter, i) => (
        <span
          key={letter + i}
          aria-hidden="true"
          className={`tile flex items-center justify-center ${box} ${
            i === 0 ? "bg-signal text-on-signal" : "bg-ink text-on-ink"
          }`}
          style={{ ["--chamfer" as string]: "6px" }}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}
