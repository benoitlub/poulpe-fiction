import type { HarvestBundle, MissionProgress } from "../types";

const KIND_MARK: Record<HarvestBundle["harvest"]["kind"], string> = {
  visual: "🖼️",
  "contact-list": "📇",
  landing: "🌐",
  text: "📝",
  "publication-pack": "📦",
};

const KIND_COLOR: Record<HarvestBundle["harvest"]["kind"], string> = {
  visual: "#7fe0d0",
  "contact-list": "#c9a7d8",
  landing: "#71c9b8",
  text: "#f6c26b",
  "publication-pack": "#e08fd0",
};

const MAX_VISIBLE_HARVESTS = 6;

interface Props {
  step?: MissionProgress["step"] | "idle";
  harvests?: HarvestBundle[];
  onSelectHarvest?: (missionId: string) => void;
}

export function OctopusGarden({ step = "idle", harvests = [], onSelectHarvest }: Props) {
  const busy = step !== "idle" && step !== "done" && step !== "blocked";
  const thinking = step === "think" || step === "consult";
  const visibleHarvests = harvests.slice(0, MAX_VISIBLE_HARVESTS);
  const overflow = harvests.length - visibleHarvests.length;
  const harvestSpots = visibleHarvests.map((bundle, index) => {
    const angle = -145 + index * (290 / Math.max(visibleHarvests.length - 1, 1));
    const radians = angle * Math.PI / 180;
    return { bundle, x: 200 + Math.cos(radians) * 142, y: 210 + Math.sin(radians) * 118 };
  });

  return (
    <div className={`pf-scene pf-signal-field${busy ? " pf-scene-busy" : ""}`} aria-label="Activité du Garden">
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="pf-core-signal">
            <stop offset="0%" stopColor="#f6c26b" stopOpacity={busy ? ".72" : ".28"} />
            <stop offset="45%" stopColor="#7fe0d0" stopOpacity={thinking ? ".2" : ".08"} />
            <stop offset="100%" stopColor="#7fe0d0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="pf-core-field" cx="200" cy="200" r="92" fill="url(#pf-core-signal)" />
        <circle cx="200" cy="200" r="7" fill="#f6c26b" opacity={busy ? ".95" : ".5"} />
        <circle cx="200" cy="200" r="18" fill="none" stroke="#f6c26b" strokeOpacity=".2" />
        {harvestSpots.map(({ bundle, x, y }) => (
          <g key={bundle.missionId}>
            <line x1="200" y1="200" x2={x} y2={y} stroke={KIND_COLOR[bundle.harvest.kind]} strokeOpacity=".12" strokeWidth=".8" />
            <g
              className="pf-harvest-node"
              style={{ transformOrigin: `${x}px ${y}px` }}
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelectHarvest?.(bundle.missionId)}
              role={onSelectHarvest ? "button" : undefined}
              tabIndex={onSelectHarvest ? 0 : undefined}
              onKeyDown={(event) => {
                if (onSelectHarvest && (event.key === "Enter" || event.key === " ")) onSelectHarvest(bundle.missionId);
              }}
            >
              <title>{bundle.harvest.title}</title>
              <circle r="11" fill={KIND_COLOR[bundle.harvest.kind]} opacity=".12" />
              <circle r="4" fill={KIND_COLOR[bundle.harvest.kind]} opacity=".88" />
            </g>
          </g>
        ))}
        {overflow > 0 ? <text x="200" y="376" textAnchor="middle" fontSize="9" fill="#a9b0cc">+{overflow} récoltes</text> : null}
      </svg>
      <div className="pf-signal-status"><span className={busy ? "is-live" : ""} />{busy ? "Gérard est actif" : "Gérard veille"}</div>
    </div>
  );
}
