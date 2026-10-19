import { TileGraphic } from "@/components/ui/tile-graphic";
import { SvgCaption, TEXT } from "./svg-text";

export function Stats() {
  const stats = [
    { value: "9 / 10", label: "COMMANDS" },
    { value: "9", label: "STEPS" },
    { value: "8", label: "BEST" },
  ];
  return (
    <g>
      <SvgCaption x={20} y={640}>
        RESULT
      </SvgCaption>
      {stats.map((stat, i) => (
        <TileGraphic key={stat.label} x={20 + i * 120} y={650} w={110} h={50} variant="ghost">
          <text
            x={75 + i * 120}
            y={673}
            textAnchor="middle"
            fontSize={22}
            className="fill-ink"
            {...TEXT}
          >
            {stat.value}
          </text>
          <text
            x={75 + i * 120}
            y={691}
            textAnchor="middle"
            fontSize={9}
            letterSpacing={1.5}
            className="fill-mute"
            {...TEXT}
          >
            {stat.label}
          </text>
        </TileGraphic>
      ))}
    </g>
  );
}
