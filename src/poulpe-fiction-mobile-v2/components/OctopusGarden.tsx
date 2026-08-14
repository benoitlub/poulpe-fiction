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
  const armsActive = step === "think" || step === "craft";
  const seedsActive = step === "craft" || step === "return" || step === "done";
  const thinking = step === "think" || step === "consult";
  const busy = step !== "idle" && step !== "done" && step !== "blocked";

  const visibleHarvests = harvests.slice(0, MAX_VISIBLE_HARVESTS);
  const overflow = harvests.length - visibleHarvests.length;
  const harvestSpots = visibleHarvests.map((bundle, index) => {
    const count = visibleHarvests.length;
    const spread = count > 1 ? 260 / (count - 1) : 0;
    const x = count > 1 ? 70 + index * spread : 200;
    const y = 336 + (index % 2 === 0 ? 0 : 16);
    return { bundle, x, y };
  });

  return (
    <div className={`pf-scene${busy ? " pf-scene-busy" : ""}`} aria-hidden={harvestSpots.length === 0}>
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="pf-moon" cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#f6e7c1" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#f6e7c1" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#f6e7c1" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pf-ground" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1c3b2d" />
            <stop offset="100%" stopColor="#0a1a13" />
          </linearGradient>
        </defs>

        {Array.from({ length: 22 }).map((_, index) => (
          <circle
            key={index}
            className="pf-star"
            cx={(index * 53) % 400}
            cy={(index * 29) % 220}
            r={((index * 7) % 3) * 0.4 + 0.6}
            fill="#e6ecff"
            style={{ animationDelay: `${(index * 0.41) % 5}s`, animationDuration: `${3 + (index % 4)}s` }}
          />
        ))}

        <g className="pf-moon-glow">
          <circle cx="300" cy="110" r="120" fill="url(#pf-moon)" />
          <circle cx="300" cy="110" r="34" fill="#f6e7c1" opacity="0.85" />
        </g>

        <path d="M0 300 Q 200 250 400 300 L 400 400 L 0 400 Z" fill="url(#pf-ground)" />

        <g stroke="#4f7f6b" strokeWidth="3" fill="none" strokeLinecap="round">
          <path className="pf-grass" style={{ transformOrigin: "60px 320px", animationDelay: "0s" }} d="M60 320 q 6 -30 -4 -60" />
          <path className="pf-grass" style={{ transformOrigin: "96px 316px", animationDelay: ".6s" }} d="M96 316 q -6 -20 4 -46" />
          <path className="pf-grass" style={{ transformOrigin: "330px 322px", animationDelay: "1.1s" }} d="M330 322 q 4 -24 -8 -46" />
          <path className="pf-grass" style={{ transformOrigin: "360px 320px", animationDelay: "1.7s" }} d="M360 320 q -4 -18 6 -38" />
        </g>

        {seedsActive ? (
          <g fill="#f6c26b">
            <circle className="pf-seed" cx="150" cy="300" r="3" />
            <circle className="pf-seed s2" cx="180" cy="310" r="2.5" />
            <circle className="pf-seed s3" cx="220" cy="300" r="3" />
            <circle className="pf-seed s4" cx="250" cy="308" r="2.5" />
          </g>
        ) : null}

        <g className="pf-bubbles" fill="#7fe0d0">
          <circle className="pf-bubble b1" cx="160" cy="270" r="2.2" />
          <circle className="pf-bubble b2" cx="238" cy="265" r="1.6" />
          <circle className="pf-bubble b3" cx="200" cy="285" r="1.9" />
          <circle className="pf-bubble b4" cx="175" cy="250" r="1.3" />
          <circle className="pf-bubble b5" cx="222" cy="255" r="1.5" />
        </g>

        <g className="pf-octo-body">
          <g fill="#6b3a7d">
            <path className="pf-leg pf-leg-1" style={{ transformOrigin: "170px 285px" }} d="M150 280 q -30 30 -10 60 q 12 -10 20 -30 q 6 -20 -10 -30 Z" />
            <path className="pf-leg pf-leg-2" style={{ transformOrigin: "230px 285px" }} d="M250 280 q 30 30 10 60 q -12 -10 -20 -30 q -6 -20 10 -30 Z" />
            <path className="pf-leg pf-leg-3" style={{ transformOrigin: "188px 290px" }} d="M180 290 q -10 40 10 60 q 6 -20 4 -50 Z" />
            <path className="pf-leg pf-leg-4" style={{ transformOrigin: "212px 290px" }} d="M220 290 q 10 40 -10 60 q -6 -20 -4 -50 Z" />
          </g>

          <ellipse cx="200" cy="240" rx="70" ry="60" fill="#6b3a7d" />
          <ellipse cx="200" cy="230" rx="60" ry="48" fill="#8a4ea0" />
          <ellipse cx="180" cy="215" rx="10" ry="6" fill="#c9a7d8" opacity="0.7" />

          <g className="pf-eyes">
            <circle cx="182" cy="238" r="6" fill="#0b1024" />
            <circle cx="218" cy="238" r="6" fill="#0b1024" />
            <circle cx="184" cy="236" r="1.6" fill="#f6e7c1" />
            <circle cx="220" cy="236" r="1.6" fill="#f6e7c1" />
          </g>
          <path d="M188 256 q 12 10 24 0" stroke="#0b1024" strokeWidth="2" fill="none" strokeLinecap="round" />

          {thinking ? (
            <g className="pf-think" fill="#e6ecff" opacity="0.85">
              <circle cx="238" cy="188" r="2.4" />
              <circle cx="250" cy="176" r="3.4" />
              <circle cx="266" cy="160" r="5" />
            </g>
          ) : null}

          <path className="pf-octo-arm-1" d="M140 250 q -50 -10 -70 20 q 10 6 30 4 q 20 -2 40 -14 Z" fill="#8a4ea0" opacity={armsActive ? 1 : 0.85} />
          <path className="pf-octo-arm-2" d="M260 250 q 50 -10 70 20 q -10 6 -30 4 q -20 -2 -40 -14 Z" fill="#8a4ea0" opacity={armsActive ? 1 : 0.85} />

          <g transform="translate(80,258) rotate(-14)">
            <rect x="0" y="0" width="26" height="18" rx="4" fill="#71c9b8" />
            <path d="M26 4 l 10 -6 l 2 6 l -10 6 Z" fill="#71c9b8" />
            {seedsActive ? (
              <g className="pf-glow-rays" stroke="#7fe0d0" strokeWidth="1.4" strokeLinecap="round">
                <line x1="38" y1="4" x2="46" y2="12" />
                <line x1="40" y1="10" x2="48" y2="18" />
                <line x1="36" y1="14" x2="44" y2="22" />
              </g>
            ) : null}
          </g>
        </g>

        {harvestSpots.map(({ bundle, x, y }) => (
          <g
            key={bundle.missionId}
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
            <circle r="9" fill={KIND_COLOR[bundle.harvest.kind]} opacity="0.24" className="pf-harvest-halo" />
            <circle r="6" fill={KIND_COLOR[bundle.harvest.kind]} />
            <text y="1" textAnchor="middle" dominantBaseline="middle" fontSize="7">{KIND_MARK[bundle.harvest.kind]}</text>
          </g>
        ))}

        {overflow > 0 ? (
          <text x="200" y="392" textAnchor="middle" fontSize="10" fill="#a9b0cc">+{overflow} autre{overflow > 1 ? "s" : ""} récolte{overflow > 1 ? "s" : ""} dans le jardin</text>
        ) : null}
      </svg>
    </div>
  );
}
