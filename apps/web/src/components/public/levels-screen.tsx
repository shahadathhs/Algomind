import { ButtonGraphic } from "@/components/ui/button-graphic";
import { CommandIcon } from "@/components/ui/command-icon";
import { TileGraphic } from "@/components/ui/tile-graphic";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/components/public/game-screen";
import { TILE_TONE, type TileVariant } from "@/lib/tile-variants";

type LevelState = "solved" | "current" | "locked" | "download";

const STATES: LevelState[] = [
  "solved",
  "solved",
  "solved",
  "solved",
  "solved",
  "current",
  "locked",
  "locked",
  "locked",
  "locked",
  "download",
  "download",
];

const VARIANT: Record<LevelState, TileVariant> = {
  solved: "solid",
  current: "signal",
  locked: "faint",
  download: "dashed",
};

const LEGEND: { state: LevelState; label: string }[] = [
  { state: "solved", label: "05 SOLVED" },
  { state: "current", label: "01 CURRENT" },
  { state: "locked", label: "04 LOCKED" },
  { state: "download", label: "02 NOT DOWNLOADED" },
];

const TILE = 78.5;
const GAP = 12;
const TEXT = { strokeWidth: 0 } as const;

/** The campaign screen: level tiles in four states, each with a shape or icon as well as a look. */
export function LevelsScreen({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}
      role="img"
      aria-label="Levels screen: twelve level tiles. Five are solved, one is current, four are locked and two are not downloaded. A Play level 6 button sits at the bottom."
      className={className ?? "block h-auto w-full"}
    >
      <TileGraphic x={20} y={22} w={40} h={40} variant="ghost" chamfer={8}>
        <CommandIcon kind="back" cx={40} cy={42} size={18} tone={TILE_TONE.ghost} />
      </TileGraphic>
      <text x={20} y={104} fontSize={10} letterSpacing={2} className="fill-mute" {...TEXT}>
        CAMPAIGN
      </text>
      <text x={20} y={138} fontSize={32} letterSpacing={0.5} className="fill-ink" {...TEXT}>
        LEVELS
      </text>
      {STATES.map((state, i) => {
        const x = 20 + (i % 4) * (TILE + GAP);
        const y = 168 + Math.floor(i / 4) * (TILE + GAP);
        const variant = VARIANT[state];
        return (
          <TileGraphic key={i} x={x} y={y} w={TILE} h={TILE} variant={variant} chamfer={15}>
            {state === "download" ? (
              <CommandIcon
                kind="download"
                cx={x + TILE / 2}
                cy={y + TILE / 2}
                size={24}
                tone={TILE_TONE.dashed}
              />
            ) : (
              <text
                x={x + TILE / 2}
                y={y + TILE / 2}
                dy="0.35em"
                textAnchor="middle"
                fontSize={24}
                className={TILE_TONE[variant]}
                {...TEXT}
              >
                {String(i + 1).padStart(2, "0")}
              </text>
            )}
          </TileGraphic>
        );
      })}
      {LEGEND.map((item, i) => {
        const y = 470 + i * 24;
        return (
          <g key={item.state}>
            <TileGraphic
              x={20}
              y={y}
              w={14}
              h={14}
              variant={VARIANT[item.state]}
              chamfer={3}
              line={1.5}
            />
            <text
              x={44}
              y={y + 7}
              dy="0.35em"
              fontSize={10}
              letterSpacing={1.5}
              className="fill-ink"
              {...TEXT}
            >
              {item.label}
            </text>
          </g>
        );
      })}
      <text x={20} y={584} fontSize={10} letterSpacing={1.5} className="fill-mute" {...TEXT}>
        OFFLINE. CONNECT TO GET NEW LEVELS.
      </text>
      <ButtonGraphic x={20} y={714} w={350} h={56} label="PLAY LEVEL 06" primary fontSize={15} />
    </svg>
  );
}
