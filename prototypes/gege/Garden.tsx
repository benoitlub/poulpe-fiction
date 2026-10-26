import React, { useState } from "react";
import type {
  GardenMission,
  GardenSnapshot,
} from "../../src/garden-gege/contracts";
import { roles, statuses, visualState } from "../../src/garden-gege/core.mjs";
import { Gege } from "./Gege";
import { Gerard } from "./Gerard";
import { useGardenCamera } from "./useGardenCamera";
const stations = {
  cueilleur: [235, 190],
  tresseur: [750, 200],
  enlumineur: [810, 320],
  passeur: [500, 440],
  greffeur: [770, 485],
  jardinier: [205, 440],
  semeur: [520, 140],
};
export function Garden({
  missions,
  onSelect,
  onCoordinator,
  onProject,
  projects,
  animate,
}: {
  missions: GardenMission[];
  onSelect: (m: GardenMission) => void;
  onCoordinator: () => void;
  onProject: (id: string) => void;
  projects: GardenSnapshot["projects"];
  animate: boolean;
}) {
  const camera = useGardenCamera();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const groups = Object.keys(roles).map((role) => {
    const entries = missions.filter((m) => m.agentRole === role);
    const priority = [
      "failed",
      "blocked",
      "running",
      "retrying",
      "queued",
      "completed",
    ];
    const representative = [...entries].sort(
      (a, b) => priority.indexOf(a.status) - priority.indexOf(b.status),
    )[0];
    return { role, entries, representative };
  });
  const visible = groups.flatMap((g) =>
    g.representative ? [g.representative] : [],
  );
  const selected = groups.find((g) => g.role === selectedRole);
  const selectGroup = (role: string) => setSelectedRole(role);
  return (
    <section
      className={"garden " + (!animate ? "still" : "")}
      aria-label="Jardin aquatique : Gérard le poulpe et les hamsters Gégé"
    >
      <div className="camera" role="group" aria-label="Commandes de caméra">
        <button
          aria-label="Zoom arrière"
          disabled={camera.camera.z <= 1}
          onClick={() => camera.zoom(-0.3)}
        >
          −
        </button>
        <output aria-label="Niveau de zoom">
          {Math.round(camera.camera.z * 100)} %
        </output>
        <button
          aria-label="Zoom avant"
          disabled={camera.camera.z >= 4}
          onClick={() => camera.zoom(0.3)}
        >
          +
        </button>
        <button onClick={camera.reset}>Tout le jardin</button>
        <button
          aria-label="Déplacer à gauche"
          onClick={() => camera.pan(-60, 0)}
        >
          ←
        </button>
        <button
          aria-label="Déplacer à droite"
          onClick={() => camera.pan(60, 0)}
        >
          →
        </button>
        <button
          aria-label="Déplacer vers le haut"
          onClick={() => camera.pan(0, -60)}
        >
          ↑
        </button>
        <button
          aria-label="Déplacer vers le bas"
          onClick={() => camera.pan(0, 60)}
        >
          ↓
        </button>
        <button aria-pressed={camera.touchExplore} onClick={camera.toggleTouch}>
          Explorer au toucher
        </button>
      </div>
      <p className="camera-help">
        {camera.touchExplore
          ? "Un doigt pour déplacer, deux pour zoomer. Désactivez l’exploration pour faire défiler la page."
          : "La page défile librement. Activez l’exploration pour déplacer et pincer le jardin au toucher."}
      </p>
      <nav className="zone-jumps" aria-label="Se rapprocher d’une zone">
        {[
          ["Noyau de Gérard", 490, 300],
          ["Serre des Idées", 235, 190],
          ["Atelier des Floraisons", 780, 260],
          ["Bassin des Courants", 500, 440],
          ["Parcelles", 520, 140],
          ["Écluses du Large", 770, 485],
          ["Compost du Feuch", 205, 440],
        ].map(([label, x, y]) => (
          <button
            key={label}
            onClick={() => camera.focus(Number(x), Number(y))}
          >
            {label}
          </button>
        ))}
      </nav>
      <div
        ref={camera.viewport}
        className={"viewport " + (camera.touchExplore ? "touch-explore" : "")}
        tabIndex={0}
        aria-label="Caméra : flèches pour déplacer, touches + et − pour zoomer, Début pour tout voir"
        data-zoom={camera.camera.z}
        {...camera.handlers}
      >
        <div
          className={"world " + (camera.scale >= 0.65 ? "detailed" : "")}
          style={camera.worldStyle}
        >
          <svg viewBox="0 0 1000 650" className="landscape" aria-hidden="true">
            <defs>
              <radialGradient id="water">
                <stop stopColor="#245e62" />
                <stop offset="1" stopColor="#102d39" />
              </radialGradient>
              <linearGradient id="land" x2="0" y2="1">
                <stop stopColor="#709278" />
                <stop offset="1" stopColor="#476b59" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" />
              </filter>
              <pattern
                id="ripples"
                width="80"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M5 30q20 10 40 0"
                  stroke="#84c5b2"
                  fill="none"
                  opacity=".08"
                />
              </pattern>
            </defs>
            <ellipse cx="500" cy="355" rx="465" ry="280" fill="url(#water)" />
            <ellipse cx="500" cy="355" rx="465" ry="280" fill="url(#ripples)" />
            <path
              d="M240 190Q490 45 760 205Q930 400 735 490Q480 635 205 450Q60 320 240 190"
              stroke="#578b80"
              strokeWidth="24"
              fill="none"
              opacity=".25"
            />
            <path
              d="M240 190Q400 240 490 310L760 205M490 310L205 450M490 310L735 490M490 310L500 465M490 310L520 140"
              stroke="#b9b080"
              strokeWidth="13"
              fill="none"
              opacity=".65"
              strokeDasharray="4 3"
            />
            {[
              [235, 190, 123, 64],
              [750, 205, 145, 72],
              [205, 450, 128, 62],
              [755, 490, 125, 62],
              [500, 460, 120, 60],
              [515, 120, 98, 48],
              [490, 315, 135, 68],
            ].map(([x, y, rx, ry], i) => (
              <g key={i}>
                <ellipse cx={x} cy={y + 15} rx={rx} ry={ry} fill="#254d45" />
                <ellipse
                  cx={x}
                  cy={y}
                  rx={rx}
                  ry={ry}
                  fill="url(#land)"
                  stroke="#94a47b"
                  strokeWidth="2"
                />
                <ellipse
                  cx={x}
                  cy={y + 3}
                  rx={rx - 12}
                  ry={ry - 10}
                  fill="none"
                  stroke="#b9c68d"
                  opacity=".24"
                />
              </g>
            ))}
            {/* Glass greenhouse, workbench, waterwheel, compost and central pavilion. */}
            <g stroke="#adc7a0" strokeWidth="3" fill="#6fae9d66">
              <path d="M165 172v-65l64-40 66 40v65l-66 38Z" />
              <path d="M165 107l64 34 66-34M229 67v143M197 87v102M263 87v103M165 139l64 35 66-35" />
            </g>
            <g fill="#a28259">
              <path d="M696 172l66-28 65 28-65 29Z" />
              <path d="M700 173v35h8v-30m112-5v36h-8v-31" />
              <rect
                x="741"
                y="131"
                width="16"
                height="27"
                rx="3"
                fill="#d4c78b"
              />
              <path
                d="M784 148v-23m-7 22 14-21"
                stroke="#dfbb78"
                strokeWidth="4"
              />
            </g>
            <g
              transform="translate(780 459)"
              stroke="#c9aa72"
              strokeWidth="5"
              fill="none"
            >
              <circle r="31" />
              <circle r="10" />
              {[0, 45, 90, 135].map((a) => (
                <path key={a} d="M-34 0h68" transform={`rotate(${a})`} />
              ))}
            </g>
            <g fill="#766c44" stroke="#b1a075" strokeWidth="3">
              <path d="M144 421l51-20 48 20v37l-48 20-51-20Z" />
              <path d="M144 433l51 20 48-20M195 453v25" />
            </g>
            <g>
              <ellipse cx="490" cy="311" rx="67" ry="35" fill="#cab87d" />
              <path
                d="M441 294v-65m99 65v-65"
                stroke="#ccb780"
                strokeWidth="7"
              />
              <path
                d="M414 234l76-65 79 65-79 29Z"
                fill="#346963"
                stroke="#92a787"
                strokeWidth="3"
              />
              <path d="M443 224l47-39 48 39-48 17Z" fill="#649078" />
              <path d="M490 168v-17" stroke="#d5b56b" strokeWidth="5" />
            </g>
            {Array.from({ length: 20 }, (_, i) => {
              const x = 70 + ((i * 137) % 850),
                y = 270 + ((i * 73) % 290);
              return (
                <g key={i}>
                  <ellipse cx={x} cy={y} rx="13" ry="6" fill="#6c9671" />
                  <path d={`M${x} ${y}l12 -4`} stroke="#274c43" />
                  <circle
                    cx={x - 3}
                    cy={y - 2}
                    r="3"
                    fill={i % 3 ? "#9fb879" : "#d6b48c"}
                  />
                </g>
              );
            })}
            {[
              [120, 270],
              [330, 145],
              [630, 127],
              [887, 342],
              [626, 540],
              [119, 490],
              [350, 530],
            ].map(([x, y], i) => (
              <g key={i}>
                <path
                  d={`M${x} ${y}q-26 -30 -17 -58q25 20 17 58q30 -42 38 -41q-2 35 -38 41`}
                  fill="#568d72"
                />
                <path d={`M${x} ${y}v-38`} stroke="#b2ba7f" strokeWidth="2" />
              </g>
            ))}
            {visible.map((m) => {
              const [x, y] = stations[m.agentRole];
              const v = visualState(m);
              return v.route ? (
                <path
                  key={m.id}
                  d={`M490 325Q${x} 340 ${x} ${y + 25}`}
                  fill="none"
                  stroke={v.blocked ? "#d8a079" : "#b9d8a2"}
                  strokeWidth="3"
                  strokeDasharray="4 12"
                  className={v.moving ? "current" : ""}
                />
              ) : null;
            })}
            <g className="zone-label">
              <text x="230" y="250">
                La Serre des Idées
              </text>
              <text x="760" y="280">
                L’Atelier des Floraisons
              </text>
              <text x="490" y="395">
                Le Noyau de Gérard
              </text>
              <text x="500" y="532">
                Le Bassin des Courants
              </text>
              <text x="770" y="570">
                Les Écluses du Large
              </text>
              <text x="200" y="527">
                Le Compost du Feuch
              </text>
              <text x="515" y="75">
                Les Parcelles
              </text>
            </g>
          </svg>
          <button
            className="chief"
            onClick={onCoordinator}
            aria-label="Gérard, poulpe coordinateur : ouvrir le noyau"
          >
            <Gerard />
            <span>Gérard</span>
          </button>
          {groups
            .filter((g) => g.representative)
            .map(({ role, entries, representative: m }) => {
              const [x, y] = stations[role];
              const v = visualState(m);
              return (
                <button
                  key={role}
                  className={`worker ${v.moving ? "working" : ""} ${v.blocked ? "obstructed" : ""}`}
                  style={{ left: `${x / 10}%`, top: `${y / 6.5}%` }}
                  onClick={() => selectGroup(role)}
                  aria-pressed={selectedRole === role}
                  aria-label={`${roles[role]} : ${entries.length} mission${entries.length > 1 ? "s" : ""}, afficher les états`}
                >
                  <Gege role={m.agentRole} />
                  <span className="worker-count" aria-hidden="true">
                    {entries.length}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
      <div className="parcels" role="group" aria-label="Parcelles du jardin">
        {projects.map((p) => (
          <button key={p.id} onClick={() => onProject(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div
        className="crew-legend"
        role="group"
        aria-label="Métiers et missions observées"
      >
        {groups.map((g) => (
          <button
            key={g.role}
            aria-pressed={selectedRole === g.role}
            onClick={() => selectGroup(g.role)}
          >
            <strong>{roles[g.role]}</strong>
            <span>
              {g.entries.length} mission{g.entries.length !== 1 ? "s" : ""}
            </span>
            <small>
              {g.entries.length
                ? Object.entries(statuses)
                    .flatMap(([status, label]) => {
                      const count = g.entries.filter(
                        (m) => m.status === status,
                      ).length;
                      return count ? [`${count} · ${label}`] : [];
                    })
                    .join(" / ")
                : "Aucune trace dans cette vue"}
            </small>
          </button>
        ))}
      </div>
      {selected && (
        <section
          className="crew-missions"
          aria-label={`Missions du métier ${roles[selected.role]}`}
        >
          <h3>{roles[selected.role]} · missions observées</h3>
          <p>
            Chaque ligne ouvre son historique. Le personnage regroupe un métier,
            pas un agent supplémentaire.
          </p>
          {selected.entries.map((m) => (
            <button
              className="crew-mission"
              key={m.id}
              onClick={() => onSelect(m)}
            >
              <span>
                {m.title}
                <small>
                  {projects.find((p) => p.id === m.projectId)?.label}
                </small>
              </span>
              <span className={"state " + m.status}>{statuses[m.status]}</span>
            </button>
          ))}
          {!selected.entries.length && (
            <p>Aucune mission pour ce métier dans les filtres actuels.</p>
          )}
        </section>
      )}
      <div className="garden-caption">
        <span>
          Gérard est le poulpe coordinateur ; les Gégé sont les hamsters des
          sept métiers.
        </span>
        <span>
          {visible.length} métiers représentés · {missions.length} missions
          consultables. Les états viennent uniquement des traces reçues.
        </span>
      </div>
    </section>
  );
}
