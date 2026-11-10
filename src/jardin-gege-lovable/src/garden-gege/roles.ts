import type { AgentRole } from "./contracts";

/**
 * Visual registry of the seven Gégé trades (Lovable side).
 * Each trade lives on its own island around Gérard's central Noyau.
 * `animated` marks trades with a full gesture set in this version;
 * the others are drawn at rest but stay in the model.
 */
export interface RoleVisual {
  role: AgentRole;
  label: string;
  /** Island name shown on the map */
  place: string;
  craft: string;
  /** CSS custom property holding the trade colour */
  tone: string;
  animated: boolean;
  /** Island centre in the scene (viewBox 1000×700); hamster stands here */
  home: { x: number; y: number };
}

export const ROLE_VISUALS: Record<AgentRole, RoleVisual> = {
  cueilleur: { role: "cueilleur", label: "Cueilleur", place: "La Serre", craft: "Récolte les idées et les informations", tone: "var(--g-moss)", animated: true, home: { x: 200, y: 250 } },
  tresseur: { role: "tresseur", label: "Tresseur", place: "Le Métier", craft: "Assemble les textes et les contenus", tone: "var(--g-sand)", animated: false, home: { x: 395, y: 115 } },
  enlumineur: { role: "enlumineur", label: "Enlumineur", place: "L'Atelier", craft: "Crée images, visuels et vidéos", tone: "var(--g-orchid)", animated: false, home: { x: 620, y: 115 } },
  semeur: { role: "semeur", label: "Semeur", place: "La Grainerie", craft: "Prépare et diffuse les publications", tone: "var(--g-periwinkle)", animated: false, home: { x: 815, y: 255 } },
  greffeur: { role: "greffeur", label: "Greffeur", place: "L'Écluse", craft: "Entretient les connexions techniques", tone: "var(--g-copper)", animated: true, home: { x: 790, y: 490 } },
  jardinier: { role: "jardinier", label: "Jardinier de fond", place: "Le Fond", craft: "Classe, archive, répare et nettoie", tone: "var(--g-moss-deep)", animated: false, home: { x: 500, y: 605 } },
  passeur: { role: "passeur", label: "Passeur", place: "Le Moulin", craft: "Transporte les données entre les ateliers", tone: "var(--g-lagoon)", animated: true, home: { x: 215, y: 490 } },
};

export const ROLE_ORDER: AgentRole[] = [
  "cueilleur", "tresseur", "enlumineur", "passeur", "greffeur", "jardinier", "semeur",
];

/** Central Noyau where Gérard sits. */
export const NOYAU = { x: 500, y: 355 };
