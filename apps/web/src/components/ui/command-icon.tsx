export type IconKind =
  | "move"
  | "repeat"
  | "left"
  | "right"
  | "step"
  | "run"
  | "reset"
  | "fail"
  | "plus"
  | "download"
  | "back"
  | "check";

type Props = {
  kind: IconKind;
  /** Center of the icon in the parent SVG's units. */
  cx: number;
  cy: number;
  size: number;
  /** Fill and stroke classes (see TILE_TONE). */
  tone: string;
};

const TURN_RIGHT = (
  <>
    <path d="M17.36 7.5A7 7 0 1 1 9.61 5.42" fill="none" strokeWidth={2.6} />
    <path d="M13.4 4.06 10.7 8.4 8.5 2.4Z" strokeWidth={0} />
  </>
);

/** The command and control icons, drawn on a 24-unit grid and scaled to `size`. */
export function CommandIcon({ kind, cx, cy, size, tone }: Props) {
  const scale = size / 24;
  const transform = `translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})`;
  return (
    <g transform={transform} className={tone} aria-hidden="true">
      {kind === "move" && <path d="M12 3 20.5 12H14.5V21H9.5V12H3.5Z" strokeWidth={0} />}
      {kind === "repeat" && (
        <path
          d="M4 8.5H17M13.5 5l3.5 3.5-3.5 3.5M20 15.5H7M10.5 12 7 15.5 10.5 19"
          fill="none"
          strokeWidth={2.4}
        />
      )}
      {kind === "right" && TURN_RIGHT}
      {(kind === "left" || kind === "reset") && (
        <g transform="translate(24 0) scale(-1 1)">{TURN_RIGHT}</g>
      )}
      {kind === "step" && (
        <>
          <path d="M5 5 15 12 5 19Z" strokeWidth={0} />
          <rect x={17} y={5} width={3.2} height={14} strokeWidth={0} />
        </>
      )}
      {kind === "run" && <path d="M7 4 19.5 12 7 20Z" strokeWidth={0} />}
      {kind === "fail" && <path d="M6 6 18 18M18 6 6 18" fill="none" strokeWidth={3.4} />}
      {kind === "plus" && <path d="M12 5V19M5 12H19" fill="none" strokeWidth={2.2} />}
      {kind === "download" && (
        <>
          <path d="M12 17 5.5 10.5H9.5V3H14.5V10.5H18.5Z" strokeWidth={0} />
          <rect x={5} y={19} width={14} height={2.4} strokeWidth={0} />
        </>
      )}
      {kind === "back" && <path d="M15 5 8 12 15 19" fill="none" strokeWidth={2.8} />}
      {kind === "check" && <path d="M5 12.5 10 17.5 19 7" fill="none" strokeWidth={3.2} />}
    </g>
  );
}
