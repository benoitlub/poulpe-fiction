import type { AgentRole } from "@/garden-gege/contracts";

export type HamsterPose = "idle" | "wait" | "work" | "scurry" | "puzzled" | "retry" | "happy";

interface HamsterProps {
  role: AgentRole | "gerard";
  pose?: HamsterPose;
  tone?: string;
  /** Static drawing (portrait or trade not yet animated) */
  still?: boolean;
  scale?: number;
  flip?: boolean;
}

/**
 * One shared hamster silhouette for the whole colony (scene + portraits).
 * Local origin = between the feet. Anatomy first: pear body, big cheek
 * pouches, round ears, twitching nose, paws held at the chest.
 */
export function Hamster({ role, pose = "idle", tone = "var(--g-lagoon)", still = false, scale = 1, flip = false }: HamsterProps) {
  return (
    <g
      className={`hamster g-anim role-${role} pose-${pose} ${still ? "static" : ""}`}
      transform={`scale(${flip ? -scale : scale} ${scale})`}
    >
      <ellipse cx="0" cy="0" rx="26" ry="5.5" fill="var(--g-abyss)" opacity="0.45" />
      <g className="h-whole">
        <g className="h-feet">
          <ellipse cx="-11" cy="-3" rx="7" ry="3.6" fill="var(--g-pink)" />
          <ellipse cx="11" cy="-3" rx="7" ry="3.6" fill="var(--g-pink)" />
        </g>
        {role === "passeur" && <Satchel tone={tone} />}
        <g className="h-body">
          <path d="M-27 -26 C-29 -48 -16 -56 0 -56 C16 -56 29 -48 27 -26 C26 -8 15 -2 0 -2 C-15 -2 -26 -8 -27 -26 Z" fill="var(--g-fur)" />
          <path d="M-17 -24 C-18 -38 -9 -44 0 -44 C9 -44 18 -38 17 -24 C16 -11 9 -6 0 -6 C-9 -6 -16 -11 -17 -24 Z" fill="var(--g-cream)" />
          <Outfit role={role} tone={tone} />
        </g>
        <g className="h-head">
          <g className="h-ear-l">
            <circle cx="-15" cy="-82" r="7.5" fill="var(--g-fur-shade)" />
            <circle cx="-15" cy="-82" r="4.2" fill="var(--g-pink)" />
          </g>
          <g className="h-ear-r">
            <circle cx="15" cy="-82" r="7.5" fill="var(--g-fur-shade)" />
            <circle cx="15" cy="-82" r="4.2" fill="var(--g-pink)" />
          </g>
          <ellipse cx="0" cy="-66" rx="23" ry="19" fill="var(--g-fur)" />
          <ellipse className="h-cheek" cx="-14" cy="-57" rx="12" ry="9.5" fill="var(--g-cream)" />
          <ellipse className="h-cheek" cx="14" cy="-57" rx="12" ry="9.5" fill="var(--g-cream)" />
          <path d="M-6 -78 Q0 -84 6 -78" stroke="var(--g-fur-shade)" strokeWidth="2" fill="none" strokeLinecap="round" />
          <g>
            <circle cx="-8.5" cy="-67" r="3.4" fill="var(--g-ink)" />
            <circle cx="8.5" cy="-67" r="3.4" fill="var(--g-ink)" />
            <circle cx="-7.4" cy="-68.2" r="1.1" fill="var(--g-cream)" />
            <circle cx="9.6" cy="-68.2" r="1.1" fill="var(--g-cream)" />
            <ellipse className="h-lid" cx="-8.5" cy="-67" rx="3.8" ry="3.8" fill="var(--g-fur)" />
            <ellipse className="h-lid" cx="8.5" cy="-67" rx="3.8" ry="3.8" fill="var(--g-fur)" />
          </g>
          <g className="h-whiskers" stroke="var(--g-cream)" strokeWidth="0.8" opacity="0.8" strokeLinecap="round">
            <path d="M-6 -59 L-24 -62 M-6 -57.5 L-23 -56 M6 -59 L24 -62 M6 -57.5 L23 -56" />
          </g>
          <ellipse className="h-nose" cx="0" cy="-60" rx="3.2" ry="2.3" fill="var(--g-pink)" />
          <path d="M-3 -56 Q0 -53.5 0 -56.5 Q0 -53.5 3 -56" stroke="var(--g-ink)" strokeWidth="1" fill="none" strokeLinecap="round" />
          {role === "gerard" && <GerardFace />}
          {role === "greffeur" && (
            <g>
              <path d="M-21 -72 Q0 -78 21 -72" stroke="var(--g-copper-deep)" strokeWidth="3" fill="none" />
              <circle cx="-13" cy="-76" r="4" fill="var(--g-lagoon-soft)" stroke="var(--g-copper-deep)" strokeWidth="1.6" />
              <circle cx="13" cy="-76" r="4" fill="var(--g-lagoon-soft)" stroke="var(--g-copper-deep)" strokeWidth="1.6" />
            </g>
          )}
        </g>
        <g className="h-paws">
          <ellipse className="h-paw-l" cx="-7" cy="-40" rx="4.6" ry="3.6" fill="var(--g-fur-shade)" />
          <ellipse className="h-paw-r" cx="7" cy="-40" rx="4.6" ry="3.6" fill="var(--g-fur-shade)" />
          <Tool role={role} />
        </g>
        <g className="h-ponder" fill="var(--g-sand)">
          <circle cx="24" cy="-92" r="2" />
          <circle cx="30" cy="-99" r="3" />
          <text x="33" y="-104" fontSize="14" fontWeight="700" fontFamily="var(--font-display)">?</text>
        </g>
      </g>
    </g>
  );
}

function Outfit({ role, tone }: { role: HamsterProps["role"]; tone: string }) {
  if (role === "gerard") {
    return (
      <g>
        <path d="M-20 -46 L-9 -46 L0 -20 L9 -46 L20 -46 C24 -36 22 -14 14 -8 L-14 -8 C-22 -14 -24 -36 -20 -46 Z" fill="var(--g-sand)" />
        <circle cx="5" cy="-30" r="1.6" fill="var(--g-copper-deep)" />
        <circle cx="5" cy="-22" r="1.6" fill="var(--g-copper-deep)" />
      </g>
    );
  }
  // Tiny work apron in trade colour; fur stays visible.
  return <path d="M-14 -36 Q0 -40 14 -36 L12 -12 Q0 -8 -12 -12 Z" fill={tone} opacity="0.9" />;
}

function Satchel({ tone }: { tone: string }) {
  return (
    <g>
      <rect x="16" y="-34" width="16" height="13" rx="4" fill="var(--g-copper)" />
      <path d="M18 -28 L30 -28" stroke={tone} strokeWidth="2" />
      <circle cx="24" cy="-34" r="3.5" fill="var(--g-moss-light)" />
    </g>
  );
}

function Tool({ role }: { role: HamsterProps["role"] }) {
  switch (role) {
    case "cueilleur":
      return (
        <g className="h-tool">
          <path d="M-12 -38 Q0 -26 12 -38 L10 -30 Q0 -22 -10 -30 Z" fill="var(--g-copper)" />
          <path d="M-4 -40 Q-2 -48 2 -46 M3 -40 Q6 -47 8 -44" stroke="var(--g-moss-light)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </g>
      );
    case "greffeur":
      return (
        <g className="h-tool">
          <path d="M9 -40 L22 -54" stroke="var(--g-sand)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="23" cy="-55" r="4" fill="none" stroke="var(--g-sand)" strokeWidth="2.5" />
        </g>
      );
    case "passeur":
      return <path className="h-tool" d="M-10 -38 L-22 -8" stroke="var(--g-copper-deep)" strokeWidth="2.5" strokeLinecap="round" />;
    case "tresseur":
      return <rect className="h-tool" x="-9" y="-44" width="18" height="10" rx="1.5" fill="var(--g-cream)" stroke="var(--g-copper)" strokeWidth="1" />;
    case "enlumineur":
      return <circle className="h-tool" cx="0" cy="-38" r="6" fill="var(--g-sand)" stroke="var(--g-orchid)" strokeWidth="2" />;
    case "semeur":
      return <rect className="h-tool" x="-6" y="-44" width="12" height="12" rx="3" fill="var(--g-sand)" />;
    case "jardinier":
      return <path className="h-tool" d="M9 -40 L20 -10 M16 -12 L24 -12" stroke="var(--g-moss-light)" strokeWidth="2.5" strokeLinecap="round" />;
    case "gerard":
      return (
        <g className="h-tool">
          <path d="M14 -40 L20 -40" stroke="var(--g-copper-deep)" strokeWidth="2" />
          <rect x="18" y="-46" width="10" height="13" rx="3" fill="var(--g-lagoon)" opacity="0.9" />
          <circle cx="23" cy="-39" r="9" fill="var(--g-lagoon)" opacity="0.18" className="g-lantern" />
        </g>
      );
  }
}

function GerardFace() {
  return (
    <g>
      <circle cx="-8.5" cy="-67" r="6" fill="none" stroke="var(--g-sand)" strokeWidth="1.8" />
      <circle cx="8.5" cy="-67" r="6" fill="none" stroke="var(--g-sand)" strokeWidth="1.8" />
      <path d="M-2.5 -67 L2.5 -67" stroke="var(--g-sand)" strokeWidth="1.8" />
    </g>
  );
}
