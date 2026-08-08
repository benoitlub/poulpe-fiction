import { useEffect, useState } from "react";

interface Exploration {
  id: string;
  title: string;
  status: string;
  narration: string;
}

// Gérard is a poulpe: several tentacles work at once (see gerard-autonomy.js).
// This narrates what's actually happening for each Seed currently being
// tended, instead of a flat status list — playful, varied, but grounded in
// the real BlacklaceParcel status (no invented progress).
const STATUS_NARRATION: Record<string, string[]> = {
  observing: ["observe encore, curieux", "renifle la piste sans se presser", "tourne autour, pas encore convaincu"],
  growing: ["laisse l’idée prendre racine", "la sent grandir doucement", "la couve, tentacule repliée"],
  "bag-ready": ["a le sac prêt, n’attend qu’un signal", "a préparé ses affaires, impatient de partir"],
  adventure: ["est parti explorer, une tentacule dehors", "nage déjà loin sur cette piste"],
  "harvest-ready": ["revient les tentacules pleines", "rapporte quelque chose à ouvrir"],
  blocked: ["s’est cogné à un mur, réfléchit à un détour", "attend un coup de main pour continuer"],
};

const STATUS_ICON: Record<string, string> = {
  observing: "👀",
  growing: "🌿",
  "bag-ready": "🎒",
  adventure: "🐙",
  "harvest-ready": "🌾",
  blocked: "⏸️",
};

const ACTIVE_STATUSES = new Set(Object.keys(STATUS_NARRATION));

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function readExplorations(): Exploration[] {
  const seeds = (window as any).BlacklaceParcel?.parcel?.seeds;
  if (!Array.isArray(seeds)) return [];
  return seeds
    .filter((seed) => ACTIVE_STATUSES.has(String(seed?.status)))
    .slice(0, 8)
    .map((seed) => {
      const status = String(seed.status);
      return {
        id: String(seed.id),
        title: String(seed.title || seed.id),
        status,
        narration: pick(STATUS_NARRATION[status] ?? ["s’en occupe"]),
      };
    });
}

export function ActiveExplorations() {
  const [explorations, setExplorations] = useState<Exploration[]>(() => readExplorations());

  useEffect(() => {
    const refresh = () => setExplorations(readExplorations());
    refresh();
    const interval = window.setInterval(refresh, 8000);
    window.addEventListener("poulpe-garden-changed", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("poulpe-garden-changed", refresh);
    };
  }, []);

  if (!explorations.length) return null;

  return (
    <section className="pf-card pf-full-width pf-explorations" aria-label="Explorations en cours">
      <p className="pf-eyebrow">🐙 Ce que Gérard explore en ce moment</p>
      <ul className="pf-exploration-list">
        {explorations.map((exploration) => (
          <li key={exploration.id} className="pf-exploration-item">
            <span className="pf-exploration-icon" aria-hidden="true">{STATUS_ICON[exploration.status] ?? "🌱"}</span>
            <span><strong>{exploration.title}</strong> — Gérard {exploration.narration}.</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
