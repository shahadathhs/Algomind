import { ImageResponse } from "next/og";
import { chamferPath } from "@/lib/geometry";
import { SITE_DESCRIPTION } from "@/lib/seo";
import { TOKEN_COLORS } from "@/lib/token-colors.generated";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const LIGHT = TOKEN_COLORS.light;
const LETTERS = ["A", "L", "G", "O", "M", "I", "N", "D"];

function Tile({
  size,
  fill,
  stroke,
  label,
  labelColor,
}: {
  size: number;
  fill?: string;
  stroke?: string;
  label?: string;
  labelColor?: string;
}) {
  const chamfer = size * 0.25;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <path
          d={
            stroke
              ? chamferPath(3, 3, size - 6, size - 6, chamfer)
              : chamferPath(0, 0, size, size, chamfer)
          }
          fill={fill ?? "none"}
          stroke={stroke}
          strokeWidth={stroke ? 6 : 0}
        />
      </svg>
      {label && (
        <div
          style={{
            display: "flex",
            fontSize: size * 0.62,
            color: labelColor,
            WebkitTextStroke: `${Math.max(1, size * 0.04)}px ${labelColor}`,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * The 1200 by 630 share image: the tile wordmark, the page title, and a short tape with one
 * yellow tile. Flat fills only, light theme, colors from the design tokens.
 */
export function renderShareImage({ title, subtitle }: { title: string; subtitle?: string }) {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        background: LIGHT.ground,
        color: LIGHT.ink,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {LETTERS.map((letter, i) => (
          <Tile
            key={letter + i}
            size={64}
            fill={i === 0 ? LIGHT.signal : LIGHT.ink}
            label={letter}
            labelColor={i === 0 ? LIGHT.onSignal : LIGHT.onInk}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 24 ? 84 : 104,
            lineHeight: 1,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: LIGHT.mute }}>
          {subtitle ?? SITE_DESCRIPTION}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Tile size={72} fill={LIGHT.ink} />
        <Tile size={72} fill={LIGHT.ink} />
        <Tile size={72} fill={LIGHT.signal} />
        <Tile size={72} stroke={LIGHT.ink} />
        <Tile size={72} stroke={LIGHT.ink} />
      </div>
    </div>,
    { ...OG_SIZE },
  );
}
