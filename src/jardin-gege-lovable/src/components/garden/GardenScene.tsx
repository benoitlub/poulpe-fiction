import { useEffect, useRef, type KeyboardEvent } from "react";
import type { AgentRole, GardenMission } from "@/garden-gege/contracts";
import { NOYAU, ROLE_ORDER, ROLE_VISUALS } from "@/garden-gege/roles";
import { Hamster } from "./Hamster";
import { Octopus } from "./Octopus";
import { gerardMood, latestByRole, poseFor, routeFor, type Selection } from "./scene-model";

export type SceneFilter = "all" | "active" | "attention";

interface Props {
  missions: GardenMission[];
  projects: { id: string; label: string }[];
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  reducedMotion: boolean;
  paused: boolean;
  filter?: SceneFilter;
}

/** Curved canal from the Noyau to an island. */
function canalPath(to: { x: number; y: number }) {
  const mx = (NOYAU.x + to.x) / 2, my = (NOYAU.y + to.y) / 2;
  const dx = to.x - NOYAU.x, dy = to.y - NOYAU.y;
  return `M${NOYAU.x} ${NOYAU.y} Q ${mx - dy * 0.22} ${my + dx * 0.22} ${to.x} ${to.y}`;
}

function matches(m: GardenMission | undefined, f: SceneFilter) {
  if (f === "all") return true;
  if (!m) return false;
  return f === "active" ? ["running", "retrying", "queued"].includes(m.status) : ["failed", "blocked"].includes(m.status);
}

export function GardenScene({ missions, projects, selection, onSelect, reducedMotion, paused, filter = "all" }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const byRole = latestByRole(missions);
  const passeur = routeFor(byRole.passeur);
  const greffeur = routeFor(byRole.greffeur);
  const failedCount = missions.filter((m) => m.status === "failed").length;
  const parcel = projects[0];
  const mood = gerardMood(missions);

  useEffect(() => {
    const s = svgRef.current;
    if (!s) return;
    if (paused) s.pauseAnimations();
    else s.unpauseAnimations();
  }, [paused]);

  const hit = (s: Selection, label: string) => ({
    className: `garden-hit ${isSel(selection, s) ? "is-selected" : ""}`,
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelect(s); },
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s); } },
  });

  return (
    <svg ref={svgRef} viewBox="0 0 1000 700" width="1000" height="700" className="block" aria-label="Le jardin aquatique des Gégé">
      <defs>
        <radialGradient id="g-pond" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="var(--g-lagoon)" stopOpacity="0.5" />
          <stop offset="70%" stopColor="var(--g-water)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--g-deep)" />
        </radialGradient>
        <radialGradient id="g-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--g-lagoon)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--g-lagoon)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="g-orchid-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--g-orchid)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--g-orchid)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diorama-earth" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="#7e9667" />
          <stop offset="38%" stopColor="#425d49" />
          <stop offset="100%" stopColor="#172e34" />
        </linearGradient>
        <radialGradient id="diorama-grass" cx="42%" cy="24%" r="80%">
          <stop offset="0%" stopColor="#a2bd7d" />
          <stop offset="60%" stopColor="#648d67" />
          <stop offset="100%" stopColor="#365b55" />
        </radialGradient>
        <linearGradient id="diorama-water" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#124854" />
          <stop offset="55%" stopColor="#092e43" />
          <stop offset="100%" stopColor="#061d30" />
        </linearGradient>
        <filter id="diorama-shadow" x="-40%" y="-70%" width="180%" height="240%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id="g-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* deep water ring + ambient shimmer */}
      <ellipse cx="500" cy="385" rx="490" ry="315" fill="#000d1d" opacity="0.65" filter="url(#diorama-shadow)" />
      <ellipse cx="500" cy="360" rx="490" ry="330" fill="url(#diorama-water)" />
      <ellipse cx="500" cy="355" rx="480" ry="319" fill="none" stroke="#8bd2c4" strokeOpacity="0.15" strokeWidth="3" />
      <g className="g-water-shimmer" opacity="0.16" fill="var(--g-lagoon)">
        <ellipse cx="120" cy="120" rx="80" ry="10" />
        <ellipse cx="880" cy="110" rx="90" ry="10" />
        <ellipse cx="320" cy="660" rx="110" ry="10" />
        <ellipse cx="700" cy="650" rx="90" ry="9" />
      </g>

      {/* bridges (structure, always present) */}
      {ROLE_ORDER.map((r) => {
        const h = ROLE_VISUALS[r].home;
        return (
          <g key={`b-${r}`}>
            <line x1={NOYAU.x + 2} y1={NOYAU.y + 8} x2={h.x + 2} y2={h.y + 8} stroke="#051b22" strokeWidth="17" opacity="0.6" />
            <line x1={NOYAU.x} y1={NOYAU.y} x2={h.x} y2={h.y} stroke="#694b38" strokeWidth="15" strokeLinecap="round" />
            <line x1={NOYAU.x} y1={NOYAU.y - 2} x2={h.x} y2={h.y - 2} stroke="#c3a47a" strokeWidth="10" strokeDasharray="13 3" strokeLinecap="round" />
            <line x1={NOYAU.x} y1={NOYAU.y - 3} x2={h.x} y2={h.y - 3} stroke="#e8d2a0" strokeWidth="2" strokeOpacity="0.65" strokeDasharray="13 3" />
          </g>
        );
      })}

      {/* luminous canals — only where an observed mission has a route */}
      {ROLE_ORDER.map((r) => {
        const st = routeFor(byRole[r]);
        if (!st.route) return null;
        const d = canalPath(ROLE_VISUALS[r].home);
        return (
          <g key={`c-${r}`} opacity={st.blocked ? 0.45 : 1}>
            <path d={d} fill="none" stroke="var(--g-lagoon)" strokeWidth="10" opacity="0.35" filter="url(#g-soft-glow)" />
            <path d={d} fill="none" stroke={st.blocked ? "var(--g-copper)" : "var(--g-lagoon)"} strokeWidth="4" strokeLinecap="round"
              className={st.moving ? "g-canal-flow" : "g-canal-still"} />
          </g>
        );
      })}

      {/* the parcel (project) */}
      {parcel && (
        <g {...hit({ kind: "parcel", projectId: parcel.id }, `Parcelle : ${parcel.label}`)}>
          <ellipse className="g-select-ring" cx="80" cy="370" rx="72" ry="44" fill="none" stroke="var(--g-lagoon)" strokeWidth="2" strokeDasharray="6 6" />
          <ellipse cx="80" cy="376" rx="62" ry="34" fill="var(--g-moss-deep)" />
          <ellipse cx="80" cy="370" rx="58" ry="30" fill="var(--g-moss)" />
          {[58, 72, 86, 100].map((x, i) => (
            <path key={x} className="g-sprout" style={{ animationDelay: `${i * 0.6}s` }} d={`M${x} 372 q-3 -10 2 -16`} stroke="var(--g-moss-light)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ))}
          <MapLabel x={80} y={418} text={parcel.label} kicker="Parcelle" />
        </g>
      )}

      {/* islands */}
      {ROLE_ORDER.map((r) => <Island key={`i-${r}`} role={r} />)}

      {/* special mechanisms, driven by observed state */}
      <WaterWheel x={150} y={520} turning={passeur.moving} />
      <Lock x={855} y={520} open={greffeur.moving} blocked={greffeur.blocked} />

      {/* Compost du Feuch */}
      <g {...hit({ kind: "compost" }, "Le Compost du Feuch")}>
        <circle className="g-compost-glow" cx="915" cy="625" r="55" fill="url(#g-orchid-glow)" />
        <path d="M875 640 Q915 580 955 640 Z" fill="var(--g-copper-deep)" />
        <path d="M886 636 Q915 598 944 636" fill="none" stroke="var(--g-orchid)" strokeWidth="2" opacity="0.7" />
        {failedCount > 0 && <circle cx="915" cy="612" r="4" fill="var(--g-orchid)" className="g-lantern" />}
        <MapLabel x={915} y={668} text="Compost du Feuch" tone="var(--g-orchid)" />
      </g>

      {/* fireflies */}
      {[[60, 200], [300, 40], [700, 40], [960, 400], [330, 640], [660, 600]].map(([x, y], i) => (
        <g key={`${x}-${y}`} className="g-lantern" style={{ animationDelay: `${i * 0.6}s` }}>
          <circle cx={x} cy={y} r="12" fill="url(#g-glow)" />
          <circle cx={x} cy={y} r="2.2" fill="var(--g-lagoon)" />
        </g>
      ))}

      {/* central Noyau + Gérard */}
      <g {...hit({ kind: "gerard" }, "Gérard, le poulpe coordinateur — ouvrir son activité")}>
        <circle cx={NOYAU.x} cy={NOYAU.y} r="118" fill="var(--g-copper-deep)" opacity="0.55" />
        <circle cx={NOYAU.x} cy={NOYAU.y - 4} r="110" fill="url(#g-pond)" stroke="var(--g-sand)" strokeOpacity="0.5" strokeWidth="3" />
        <circle cx={NOYAU.x} cy={NOYAU.y - 4} r="92" fill="none" stroke="var(--g-lagoon)" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="2 6" />
        <ellipse className="g-ripple" cx="455" cy="330" rx="26" ry="9" fill="none" stroke="var(--g-cream)" strokeOpacity="0.4" />
        <ellipse className="g-ripple" style={{ animationDelay: "2.5s" }} cx="550" cy="385" rx="26" ry="9" fill="none" stroke="var(--g-cream)" strokeOpacity="0.4" />
        {[[420, 300, 0], [585, 310, 1.5], [440, 410, 3]].map(([x, y, d]) => (
          <g key={`${x}`} className="g-lily" style={{ animationDelay: `${d}s` }}>
            <ellipse cx={x} cy={y} rx="16" ry="6" fill="var(--g-moss)" opacity="0.9" />
            <circle cx={(x ?? 0) + 4} cy={(y ?? 0) - 3} r="3.5" fill="var(--g-orchid)" opacity="0.85" />
          </g>
        ))}
        <circle className="g-select-ring" cx={NOYAU.x} cy={NOYAU.y - 4} r="122" fill="none" stroke="var(--g-sand)" strokeWidth="2" strokeDasharray="6 6" />
        <g transform={`translate(${NOYAU.x} ${NOYAU.y + 40})`}>
          {!reducedMotion && <animateTransform attributeName="transform" type="translate" additive="sum" values="0 0; 0 -7; 0 0" dur="5s" repeatCount="indefinite" />}
          <Octopus mood={mood} scale={1.15} still={reducedMotion} />
        </g>
        <MapLabel x={NOYAU.x} y={NOYAU.y + 92} text="Le Noyau · Gérard" tone="var(--g-sand)" />
      </g>

      {/* the colony */}
      {ROLE_ORDER.map((role) => (
        <Gege key={role} role={role} mission={byRole[role]} reducedMotion={reducedMotion}
          dimmed={!matches(byRole[role], filter)}
          hit={hit({ kind: "role", role }, `${ROLE_VISUALS[role].label} — ${ROLE_VISUALS[role].place}`)} />
      ))}
    </svg>
  );
}

function MapLabel({ x, y, text, kicker, tone = "var(--g-cream)" }: { x: number; y: number; text: string; kicker?: string; tone?: string }) {
  const w = Math.max(60, text.length * 8.4 + 20);
  return (
    <g className="g-map-label" pointerEvents="none">
      <rect x={x - w / 2} y={y - 14} width={w} height={kicker ? 32 : 22} rx="11" fill="var(--g-abyss)" opacity="0.82" />
      <text x={x} y={y + 2} textAnchor="middle" fontSize="14" fontFamily="var(--font-display)" fontWeight="700" fill={tone}>{text}</text>
      {kicker && <text x={x} y={y + 14} textAnchor="middle" fontSize="9" fontWeight="600" letterSpacing="1.5" fill="var(--g-lagoon)">{kicker.toUpperCase()}</text>}
    </g>
  );
}

/** One circular island per trade, with its own small building. */
function Island({ role }: { role: AgentRole }) {
  const v = ROLE_VISUALS[role];
  const { x, y } = v.home;
  return (
    <g>
      <ellipse cx={x + 8} cy={y + 30} rx="83" ry="38" fill="#001824" opacity="0.7" filter="url(#diorama-shadow)" />
      <path d={`M${x-75} ${y+3} Q${x-79} ${y+27} ${x-47} ${y+39} Q${x} ${y+63} ${x+53} ${y+37} Q${x+83} ${y+24} ${x+75} ${y+3} Z`} fill="url(#diorama-earth)" stroke="#233d39" strokeWidth="2" />
      <ellipse cx={x} cy={y} rx="76" ry="37" fill="url(#diorama-grass)" stroke="#b3c99b" strokeOpacity="0.65" strokeWidth="2" />
      <ellipse cx={x-19} cy={y-12} rx="42" ry="12" fill="#d5e4a7" opacity="0.11" />
      <Building role={role} x={x} y={y} />
      {/* aquatic plants on the shore */}
      <path d={`M${x - 60} ${y + 18} q-2 -14 4 -20 M${x - 54} ${y + 22} q0 -12 6 -16`} stroke="var(--g-moss-light)" strokeWidth="2.2" fill="none" strokeLinecap="round" className="g-sprout" />
      <circle cx={x + 58} cy={y + 16} r="3.5" fill="var(--g-orchid)" opacity="0.85" />
      <MapLabel x={x} y={y + 56} text={v.place} kicker={v.label} />
    </g>
  );
}

function Building({ role, x, y }: { role: AgentRole; x: number; y: number }) {
  const bx = x + 32, by = y - 6;
  switch (role) {
    case "cueilleur": // greenhouse
      return (
        <g>
          <path d={`M${bx - 22} ${by + 6} Q${bx - 22} ${by - 34} ${bx} ${by - 34} Q${bx + 22} ${by - 34} ${bx + 22} ${by + 6} Z`} fill="var(--g-lagoon)" fillOpacity="0.25" stroke="var(--g-cream)" strokeOpacity="0.65" strokeWidth="1.5" />
          <path d={`M${bx} ${by - 34} V${by + 6} M${bx - 20} ${by - 14} H${bx + 20}`} stroke="var(--g-cream)" strokeOpacity="0.4" />
        </g>
      );
    case "tresseur": // loom hut
      return (
        <g>
          <rect x={bx - 16} y={by - 22} width="32" height="26" rx="6" fill="var(--g-sand)" opacity="0.85" />
          <path d={`M${bx - 20} ${by - 20} Q${bx} ${by - 40} ${bx + 20} ${by - 20} Z`} fill="var(--g-copper)" />
          <path d={`M${bx - 10} ${by - 14} V${by} M${bx - 3} ${by - 14} V${by} M${bx + 4} ${by - 14} V${by} M${bx + 11} ${by - 14} V${by}`} stroke="var(--g-copper-deep)" strokeWidth="1.2" />
        </g>
      );
    case "enlumineur": // dome atelier
      return (
        <g>
          <path d={`M${bx - 20} ${by + 4} Q${bx - 20} ${by - 30} ${bx} ${by - 30} Q${bx + 20} ${by - 30} ${bx + 20} ${by + 4} Z`} fill="var(--g-orchid)" opacity="0.55" />
          <circle cx={bx} cy={by - 12} r="6" fill="var(--g-sand)" />
        </g>
      );
    case "semeur": // seed silo
      return (
        <g>
          <rect x={bx - 11} y={by - 30} width="22" height="34" rx="10" fill="var(--g-periwinkle)" opacity="0.85" />
          <circle cx={bx} cy={by - 18} r="3" fill="var(--g-sand)" />
          <circle cx={bx} cy={by - 8} r="3" fill="var(--g-sand)" />
        </g>
      );
    case "greffeur": // copper workshop with pipes
      return (
        <g>
          <rect x={bx - 16} y={by - 22} width="32" height="26" rx="4" fill="var(--g-copper)" />
          <path d={`M${bx + 16} ${by - 10} H${bx + 32} V${by + 12}`} stroke="var(--g-copper-deep)" strokeWidth="5" fill="none" />
          <circle cx={bx} cy={by - 10} r="6" fill="none" stroke="var(--g-sand)" strokeWidth="2" />
        </g>
      );
    case "jardinier": // root burrow
      return (
        <g>
          <ellipse cx={bx} cy={by} rx="18" ry="12" fill="var(--g-abyss)" opacity="0.7" />
          <path d={`M${bx - 18} ${by} Q${bx} ${by - 26} ${bx + 18} ${by}`} fill="none" stroke="var(--g-copper-deep)" strokeWidth="4" />
        </g>
      );
    case "passeur": // dock
      return (
        <g>
          <path d={`M${bx - 10} ${by + 4} H${bx + 30}`} stroke="var(--g-sand)" strokeWidth="6" />
          <path d={`M${bx - 6} ${by + 4} V${by + 14} M${bx + 22} ${by + 4} V${by + 14}`} stroke="var(--g-copper-deep)" strokeWidth="3" />
        </g>
      );
  }
}

function WaterWheel({ x, y, turning }: { x: number; y: number; turning: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <g className={turning ? "g-wheel-turn" : ""}>
        <circle r="22" fill="none" stroke="var(--g-copper)" strokeWidth="4" />
        <circle r="6" fill="var(--g-copper-deep)" />
        {[0, 45, 90, 135].map((a) => <path key={a} d="M-24 0 H24" stroke="var(--g-sand)" strokeWidth="2.5" transform={`rotate(${a})`} />)}
      </g>
    </g>
  );
}

function Lock({ x, y, open, blocked }: { x: number; y: number; open: boolean; blocked: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <rect x="-26" y="-6" width="52" height="16" rx="3" fill="var(--g-water)" opacity="0.8" />
      <rect x="-30" y="-24" width="8" height="36" fill="var(--g-copper-deep)" />
      <rect x="22" y="-24" width="8" height="36" fill="var(--g-copper-deep)" />
      <rect className="g-lock-gate" x="-4" y={open ? -30 : -14} width="8" height="26" fill={blocked ? "var(--g-orchid)" : "var(--g-copper)"} />
    </g>
  );
}

function Gege({ role, mission, reducedMotion, hit, dimmed }: { role: AgentRole; mission: GardenMission | undefined; reducedMotion: boolean; hit: object; dimmed: boolean }) {
  const v = ROLE_VISUALS[role];
  const pose = poseFor(mission, role);
  const travelling = role === "passeur" && pose === "scurry";
  const path = canalPath(v.home);
  const s = v.animated ? 0.6 : 0.5;
  return (
    <g {...hit} opacity={dimmed ? 0.35 : 1}>
      {/* large invisible tap target for fingers */}
      <circle cx={v.home.x} cy={v.home.y - 20} r="38" fill="transparent" />
      <g transform={travelling && !reducedMotion ? undefined : `translate(${v.home.x - 8} ${v.home.y + 6})`}>
        {!travelling && !reducedMotion && <animateTransform attributeName="transform" type="translate" additive="sum"
          values="0 0; 10 -3; 17 1; 5 -2; 0 0" dur="12s" begin={`-${ROLE_ORDER.indexOf(role) * 1.7}s`} repeatCount="indefinite" />}
        {travelling && !reducedMotion && (
          <animateMotion dur="8s" repeatCount="indefinite" path={path} keyPoints="1;0.35;1" keyTimes="0;0.5;1" calcMode="linear" />
        )}
        <ellipse className="g-select-ring" cx="0" cy="0" rx="26" ry="9" fill="none" stroke={v.tone} strokeWidth="2.5" />
        <Hamster role={role} pose={pose} tone={v.tone} scale={s} still={reducedMotion} />
        {mission?.status === "completed" && (
          <g className="g-flower-open" transform="translate(22 -4)">
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} className="g-petal" cx="0" cy="-6" rx="3.5" ry="7" fill="var(--g-orchid)" transform={`rotate(${a})`} />
            ))}
            <circle r="3" fill="var(--g-sand)" />
          </g>
        )}
      </g>
    </g>
  );
}

function isSel(a: Selection | null, b: Selection) {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === "role" && b.kind === "role") return a.role === b.role;
  if (a.kind === "parcel" && b.kind === "parcel") return a.projectId === b.projectId;
  return true;
}
