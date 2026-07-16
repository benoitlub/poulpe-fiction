import type { MissionProgress } from "../types";

export function OctopusGarden({ step = "prepare" }: { step?: MissionProgress["step"] }) {
  const armsActive = step === "think" || step === "craft";
  const seedsActive = step === "craft" || step === "return" || step === "done";

  return (
    <div className="pf-scene" aria-hidden="true">
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
          <circle key={index} cx={(index * 53) % 400} cy={(index * 29) % 220} r={((index * 7) % 3) * 0.4 + 0.6} fill="#e6ecff" opacity={0.5 + ((index * 13) % 40) / 100} />
        ))}
        <circle cx="300" cy="110" r="120" fill="url(#pf-moon)" />
        <circle cx="300" cy="110" r="34" fill="#f6e7c1" opacity="0.85" />
        <path d="M0 300 Q 200 250 400 300 L 400 400 L 0 400 Z" fill="url(#pf-ground)" />
        <g stroke="#4f7f6b" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M60 320 q 6 -30 -4 -60" /><path d="M96 316 q -6 -20 4 -46" /><path d="M330 322 q 4 -24 -8 -46" /><path d="M360 320 q -4 -18 6 -38" />
        </g>
        {seedsActive ? <g fill="#f6c26b"><circle className="pf-seed" cx="150" cy="300" r="3" /><circle className="pf-seed s2" cx="180" cy="310" r="2.5" /><circle className="pf-seed s3" cx="220" cy="300" r="3" /><circle className="pf-seed s4" cx="250" cy="308" r="2.5" /></g> : null}
        <g className="pf-octo-body">
          <ellipse cx="200" cy="240" rx="70" ry="60" fill="#6b3a7d" />
          <ellipse cx="200" cy="230" rx="60" ry="48" fill="#8a4ea0" />
          <ellipse cx="180" cy="215" rx="10" ry="6" fill="#c9a7d8" opacity="0.7" />
          <circle cx="182" cy="238" r="6" fill="#0b1024" /><circle cx="218" cy="238" r="6" fill="#0b1024" />
          <circle cx="184" cy="236" r="1.6" fill="#f6e7c1" /><circle cx="220" cy="236" r="1.6" fill="#f6e7c1" />
          <path d="M188 256 q 12 10 24 0" stroke="#0b1024" strokeWidth="2" fill="none" strokeLinecap="round" />
          <g fill="#6b3a7d"><path d="M150 280 q -30 30 -10 60 q 12 -10 20 -30 q 6 -20 -10 -30 Z" /><path d="M250 280 q 30 30 10 60 q -12 -10 -20 -30 q -6 -20 10 -30 Z" /><path d="M180 290 q -10 40 10 60 q 6 -20 4 -50 Z" /><path d="M220 290 q 10 40 -10 60 q -6 -20 -4 -50 Z" /></g>
          <path className="pf-octo-arm-1" d="M140 250 q -50 -10 -70 20 q 10 6 30 4 q 20 -2 40 -14 Z" fill="#8a4ea0" opacity={armsActive ? 1 : 0.85} />
          <path className="pf-octo-arm-2" d="M260 250 q 50 -10 70 20 q -10 6 -30 4 q -20 -2 -40 -14 Z" fill="#8a4ea0" opacity={armsActive ? 1 : 0.85} />
          <g transform="translate(80,258) rotate(-14)"><rect x="0" y="0" width="26" height="18" rx="4" fill="#71c9b8" /><path d="M26 4 l 10 -6 l 2 6 l -10 6 Z" fill="#71c9b8" />{seedsActive ? <g stroke="#7fe0d0" strokeWidth="1.4" strokeLinecap="round"><line x1="38" y1="4" x2="46" y2="12" /><line x1="40" y1="10" x2="48" y2="18" /><line x1="36" y1="14" x2="44" y2="22" /></g> : null}</g>
        </g>
      </svg>
    </div>
  );
}
