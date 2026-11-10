export type OctopusMood = "calm" | "busy" | "concerned";

/**
 * Gérard, the coordinating octopus of the central Noyau.
 * Mood comes only from observed mission statuses (see gerardMood).
 * Local origin = waterline under the mantle.
 */
export function Octopus({ mood = "calm", still = false, scale = 1 }: { mood?: OctopusMood; still?: boolean; scale?: number }) {
  const arms = [-62, -40, -18, 4, 26, 48];
  return (
    <g className={`octopus mood-${mood} ${still ? "static" : ""}`} transform={`scale(${scale})`}>
      <ellipse cx="0" cy="4" rx="58" ry="10" fill="var(--g-abyss)" opacity="0.4" />
      {/* tentacles */}
      {arms.map((x, i) => (
        <path
          key={x}
          className="o-arm"
          style={{ animationDelay: `${i * 0.35}s` }}
          d={`M${x * 0.35} -18 C ${x * 0.7} -2, ${x} 4, ${x + (x < 0 ? -10 : 10)} -8`}
          stroke="var(--g-octo)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {[-44, -20, 20, 44].map((x) => (
        <circle key={x} cx={x} cy="-1" r="1.8" fill="var(--g-octo-light)" />
      ))}
      {/* mantle */}
      <g className="o-mantle">
        <path d="M-30 -18 C-36 -60 -20 -84 0 -84 C20 -84 36 -60 30 -18 C20 -10 -20 -10 -30 -18 Z" fill="var(--g-octo)" />
        <path d="M-18 -60 C-14 -74 -4 -78 4 -77" stroke="var(--g-octo-light)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.6" />
        {[[-14, -72], [12, -66], [18, -50]].map(([x, y]) => (
          <circle key={`${x}`} cx={x} cy={y} r="2.4" fill="var(--g-octo-light)" opacity="0.7" />
        ))}
        {/* eyes + round glasses */}
        <g className="o-eyes">
          <circle cx="-11" cy="-40" r="8" fill="var(--g-cream)" />
          <circle cx="11" cy="-40" r="8" fill="var(--g-cream)" />
          <circle className="o-pupil" cx="-10" cy="-39" r="3.6" fill="var(--g-ink)" />
          <circle className="o-pupil" cx="12" cy="-39" r="3.6" fill="var(--g-ink)" />
          <ellipse className="o-lid" cx="-11" cy="-40" rx="8.5" ry="8.5" fill="var(--g-octo)" />
          <ellipse className="o-lid" cx="11" cy="-40" rx="8.5" ry="8.5" fill="var(--g-octo)" />
        </g>
        <circle cx="-11" cy="-40" r="10" fill="none" stroke="var(--g-sand)" strokeWidth="2" />
        <circle cx="11" cy="-40" r="10" fill="none" stroke="var(--g-sand)" strokeWidth="2" />
        <path d="M-1 -40 L1 -40" stroke="var(--g-sand)" strokeWidth="2" />
        {mood === "concerned"
          ? <path d="M-6 -24 Q0 -28 6 -24" stroke="var(--g-ink)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          : <path d="M-6 -26 Q0 -21 6 -26" stroke="var(--g-ink)" strokeWidth="1.8" fill="none" strokeLinecap="round" />}
        {/* golden collar with compass */}
        <path d="M-26 -20 Q0 -12 26 -20" stroke="var(--g-sand)" strokeWidth="4" fill="none" />
        <circle cx="0" cy="-15" r="4" fill="var(--g-copper)" stroke="var(--g-sand)" strokeWidth="1.5" />
      </g>
      {/* lantern held by a raised arm */}
      <path className="o-arm-lantern" d="M26 -26 C 44 -40, 54 -54, 50 -70" stroke="var(--g-octo)" strokeWidth="7" strokeLinecap="round" fill="none" />
      <rect x="44" y="-86" width="12" height="15" rx="3" fill="var(--g-lagoon)" opacity="0.9" />
      <circle cx="50" cy="-79" r="14" fill="var(--g-lagoon)" opacity="0.2" className="g-lantern" />
      {mood === "concerned" && (
        <g className="h-ponder" style={{ opacity: 1 }} fill="var(--g-sand)">
          <text x="-48" y="-78" fontSize="18" fontWeight="700" fontFamily="var(--font-display)">?</text>
        </g>
      )}
    </g>
  );
}
