import type { ReactNode } from "react";
import { chamferOutline, chamferPath, insetChamfer } from "@/lib/geometry";
import { TILE_FILL, TILE_INNER_FILL, type TileVariant } from "@/lib/tile-variants";

type Props = {
  x: number;
  y: number;
  w: number;
  h: number;
  variant: TileVariant;
  /** Chamfer size; defaults to 0.2 of the shorter side, as in the design guide. */
  chamfer?: number;
  /** Outline thickness for the outlined variants. */
  line?: number;
  children?: ReactNode;
};

/** A tile drawn in SVG: a rectangle with the top-right corner cut. Children draw on top of it. */
export function TileGraphic({ x, y, w, h, variant, chamfer, line = 2, children }: Props) {
  const c = chamfer ?? Math.round(Math.min(w, h) * 0.2);
  const inner = TILE_INNER_FILL[variant];

  let shape: ReactNode;
  if (variant === "dashed") {
    shape = (
      <path
        d={chamferPath(x + 1, y + 1, w - 2, h - 2, insetChamfer(c, 1))}
        className="fill-none stroke-slot"
        strokeWidth={2}
        strokeDasharray="5 4"
      />
    );
  } else if (inner) {
    const { outer, inner: innerPath } = chamferOutline(x, y, w, h, c, line);
    shape = (
      <>
        <path d={outer} className={TILE_FILL[variant]} />
        <path d={innerPath} className={inner} />
      </>
    );
  } else {
    shape = <path d={chamferPath(x, y, w, h, c)} className={TILE_FILL[variant]} />;
  }

  return (
    <g>
      {shape}
      {children}
    </g>
  );
}
