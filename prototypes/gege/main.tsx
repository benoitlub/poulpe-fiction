import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  GardenMission,
  GardenSnapshot,
  GardenMode,
  ConnectionState,
} from "../../src/garden-gege/contracts";
import {
  roles,
  statuses,
  parseSnapshot,
  projectMissions,
  visualState,
  mergeEvents,
} from "../../src/garden-gege/core.mjs";
import { demoSnapshot } from "./demo";
import "./style.css";
const stations = {
  cueilleur: [235, 190],
  tresseur: [750, 200],
  enlumineur: [810, 320],
  passeur: [500, 440],
  greffeur: [770, 485],
  jardinier: [205, 440],
  semeur: [520, 140],
};
const colors = {
  cueilleur: "#8caf64",
  tresseur: "#d8b069",
  enlumineur: "#c78bb5",
  passeur: "#6ec5c4",
  greffeur: "#c88b62",
  jardinier: "#8b9d66",
  semeur: "#9fa9de",
};
function Gege({
  role = "jardinier",
  chief = false,
}: {
  role?: string;
  chief?: boolean;
}) {
  const color = chief ? "#dcb46e" : colors[role];
  const tools = {
    cueilleur: "✿",
    tresseur: "✎",
    enlumineur: "✧",
    passeur: "↗",
    greffeur: "⚒",
    jardinier: "♧",
    semeur: "⋆",
  };
  return (
    <svg viewBox="0 0 70 90" aria-hidden="true">
      <ellipse cx="35" cy="82" rx="25" ry="6" fill="#051f28" opacity=".45" />
      <path
        d="M23 70v10m24-10v10"
        stroke="#443d35"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path d="M17 45Q35 32 53 45L55 72Q35 81 15 72Z" fill={color} />
      <path
        d="M18 48L8 66m44-18 9 16"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <circle cx="35" cy="32" r="18" fill="#e0b495" />
      <path
        d="M16 35Q18 66 35 69Q54 61 54 35L43 44H27Z"
        fill={chief ? "#eee2c9" : "#e0d1b4"}
      />
      <ellipse cx="35" cy="40" rx="6" ry="4" fill="#d5977d" />
      <circle cx="28" cy="30" r="2" fill="#233336" />
      <circle cx="42" cy="30" r="2" fill="#233336" />
      <path d="M15 23Q16 4 34 5Q54 5 54 23Z" fill={color} />
      <path
        d="M9 24Q34 19 61 24"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M24 49q11 8 23 0" fill="none" stroke="#baa58a" strokeWidth="2" />
      <text x="52" y="67" fontSize="24" fill="#f5df9d">
        {chief ? "❋" : tools[role]}
      </text>
    </svg>
  );
}
function Garden({
  missions,
  onSelect,
  onProject,
  projects,
  animate,
}: {
  missions: GardenMission[];
  onSelect: (m: GardenMission) => void;
  onProject: (id: string) => void;
  projects: GardenSnapshot["projects"];
  animate: boolean;
}) {
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const visible = missions.slice(0, 12);
  return (
    <section
      className={"garden " + (!animate ? "still" : "")}
      aria-label="Jardin interactif"
    >
      <div className="camera" aria-label="Commandes de caméra">
        <button
          aria-label="Zoom arrière"
          onClick={() =>
            setCamera((c) => ({ ...c, z: Math.max(0.65, c.z - 0.15) }))
          }
        >
          −
        </button>
        <button
          aria-label="Zoom avant"
          onClick={() =>
            setCamera((c) => ({ ...c, z: Math.min(1.8, c.z + 0.15) }))
          }
        >
          +
        </button>
        <button onClick={() => setCamera({ x: 0, y: 0, z: 1 })}>
          Recentrer
        </button>
        <button
          aria-label="Déplacer à gauche"
          onClick={() => setCamera((c) => ({ ...c, x: c.x - 50 }))}
        >
          ←
        </button>
        <button
          aria-label="Déplacer à droite"
          onClick={() => setCamera((c) => ({ ...c, x: c.x + 50 }))}
        >
          →
        </button>
        <button
          aria-label="Déplacer vers le haut"
          onClick={() => setCamera((c) => ({ ...c, y: c.y - 50 }))}
        >
          ↑
        </button>
        <button
          aria-label="Déplacer vers le bas"
          onClick={() => setCamera((c) => ({ ...c, y: c.y + 50 }))}
        >
          ↓
        </button>
      </div>
      <div
        className="viewport"
        tabIndex={0}
        aria-label="Caméra : flèches pour déplacer, touches + et − pour zoomer"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          const d = {
            ArrowLeft: [-30, 0],
            ArrowRight: [30, 0],
            ArrowUp: [0, -30],
            ArrowDown: [0, 30],
          }[e.key];
          if (d) {
            e.preventDefault();
            setCamera((c) => ({ ...c, x: c.x + d[0], y: c.y + d[1] }));
          }
          if (["+", "-"].includes(e.key)) {
            e.preventDefault();
            setCamera((c) => ({
              ...c,
              z: Math.max(
                0.65,
                Math.min(1.8, c.z + (e.key === "+" ? 0.1 : -0.1)),
              ),
            }));
          }
        }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("button")) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            ox: camera.x,
            oy: camera.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d)
            setCamera((c) => ({
              ...c,
              x: Math.max(-500, Math.min(500, d.ox + e.clientX - d.x)),
              y: Math.max(-400, Math.min(400, d.oy + e.clientY - d.y)),
            }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div
          className="world"
          style={{
            transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.z})`,
          }}
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
          <div className="chief">
            <Gege chief />
            <span>Gérard</span>
          </div>
          {visible.map((m, i) => {
            const [x, y] = stations[m.agentRole];
            const v = visualState(m);
            const offset = visible
              .slice(0, i)
              .filter((n) => n.agentRole === m.agentRole).length;
            return (
              <button
                key={m.id}
                className={`worker ${v.moving ? "working" : ""} ${v.blocked ? "obstructed" : ""}`}
                style={{
                  left: `${(x + offset * 33) / 10}%`,
                  top: `${(y + offset * 6) / 6.5}%`,
                }}
                onClick={() => onSelect(m)}
                aria-label={`${roles[m.agentRole]} : ${m.title}, ${statuses[m.status]}`}
              >
                <Gege role={m.agentRole} />
                <span>
                  {v.blocked ? "!" : v.delivered ? "✓" : "·"}{" "}
                  {roles[m.agentRole]}
                </span>
              </button>
            );
          })}
          <div className="parcels">
            {projects.map((p) => (
              <button key={p.id} onClick={() => onProject(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="garden-caption">
        <span>Glissez pour explorer · sélectionnez un Gégé</span>
        <span>
          {missions.length > 12
            ? `12 Gégé visibles · ${missions.length - 12} autres missions dans la synthèse`
            : "Les métiers représentent des fonctions du système."}
        </span>
      </div>
    </section>
  );
}
function App() {
  const [demoData, setDemoData] = useState(demoSnapshot);
  const [mode, setMode] = useState<GardenMode>("demo");
  const [snapshot, setSnapshot] = useState<GardenSnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [refresh, setRefresh] = useState(0);
  const [project, setProject] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [animate, setAnimate] = useState(true);
  const inspector = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mode === "demo") return;
    let disposed = false;
    const controller = new AbortController();
    setConnection("loading");
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch("./snapshot.json", {
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("offline");
        try {
          const next = parseSnapshot(await r.json(), "real");
          if (!disposed) {
            setSnapshot((old) => ({
              ...next,
              ...mergeEvents(old?.events ?? [], next.events, "real"),
              rejectedCount: next.rejectedCount,
            }));
            setConnection("snapshot");
          }
        } catch {
          if (!disposed) setConnection("invalid");
        }
      })
      .catch(() => {
        if (!disposed) setConnection("offline");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, refresh]);
  useEffect(() => {
    const online = () => setRefresh((n) => n + 1);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  const data = mode === "demo" ? demoData : snapshot;
  const missions = useMemo(
    () => projectMissions(data?.events ?? [], mode) as GardenMission[],
    [data, mode],
  );
  const filtered = missions.filter(
    (m) =>
      (!project || m.projectId === project) &&
      (!role || m.agentRole === role) &&
      (!status || m.status === status),
  );
  const chosen = missions.find((m) => m.id === selected);
  const issues = missions.filter((m) =>
    ["blocked", "failed"].includes(m.status),
  );
  const active = missions.filter((m) =>
    ["running", "retrying"].includes(m.status),
  );
  const demoStep = (m: GardenMission) => {
    const status =
      m.status === "failed" || m.status === "blocked"
        ? "retrying"
        : "completed";
    const last = demoData.events.at(-1)!;
    const timestamp = new Date(Date.parse(last.timestamp) + 1000).toISOString();
    const event = {
      ...m.history.at(-1)!,
      id: "demo-step-" + demoData.events.length,
      sourceEventId: "demo-step-" + demoData.events.length,
      status,
      type: "demo." + status,
      timestamp,
    };
    setDemoData((d) => ({ ...d, events: [...d.events, event as typeof last] }));
  };
  const choose = (m: GardenMission) => {
    setSelected(m.id);
    requestAnimationFrame(() => inspector.current?.focus());
  };
  const switchMode = (m: GardenMode) => {
    setMode(m);
    setSelected(null);
    setProject("");
    setRole("");
    setStatus("");
  };
  return (
    <div className="app">
      <header>
        <a className="brand" href="#main">
          <span className="brand-icon">✳</span>
          <span>
            POULPE FICTION<small>Un écosystème qui prend soin des idées</small>
          </span>
        </a>
        <span className="prototype">EXPLORATION · PROTOTYPE ISOLÉ</span>
      </header>
      <main id="main">
        <div className="intro">
          <div>
            <div className="eyebrow">LA CABANE DE GÉRARD / LE JARDIN</div>
            <h1>
              Le Jardin des <em>Gégé</em>
              <span>✽</span>
            </h1>
            <p>
              Pendant que les idées poussent, les Gégé s’occupent du jardin.
            </p>
          </div>
          <div className="modes" aria-label="Source de données">
            <button
              aria-pressed={mode === "demo"}
              onClick={() => switchMode("demo")}
            >
              Démonstration
            </button>
            <button
              aria-pressed={mode === "real"}
              onClick={() => switchMode("real")}
            >
              Traces réelles
            </button>
          </div>
        </div>
        <div className={"source-banner " + mode} role="status">
          {mode === "demo" ? (
            <>
              <strong>DONNÉES FICTIVES</strong>
              <span>
                Sept métiers en démonstration. Aucune mission réelle n’est
                exécutée.
              </span>
            </>
          ) : (
            <>
              <strong>
                {connection === "loading"
                  ? "CHARGEMENT"
                  : connection === "snapshot"
                    ? "INSTANTANÉ RÉEL"
                    : connection === "invalid"
                      ? "RÉPONSE INVALIDE"
                      : "HORS LIGNE"}
              </strong>
              <span>
                {snapshot
                  ? `Traces enregistrées · actualisation du fichier : ${new Date(snapshot.generatedAt).toLocaleString("fr-FR")}. Historique partiel, sans suivi en direct.`
                  : "Aucun instantané disponible. Le jardin attend sa source."}
              </span>
              <button onClick={() => setRefresh((n) => n + 1)}>Relire</button>
            </>
          )}
        </div>
        <div className="toolbar">
          <div className="filters">
            <label>
              Parcelle
              <select
                aria-label="Parcelle"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">Toutes les parcelles</option>
                {data?.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Métier
              <select
                aria-label="Métier"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Tous les Gégé</option>
                {Object.entries(roles).map(([id, label]) => (
                  <option key={id} value={id}>
                    {String(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              État
              <select
                aria-label="État"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Tous les états</option>
                {Object.entries(statuses).map(([id, label]) => (
                  <option key={id} value={id}>
                    {String(label)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="view-controls">
            <button
              onClick={() => setAnimate((a) => !a)}
              aria-pressed={!animate}
            >
              {animate ? "Pause des animations" : "Reprendre les animations"}
            </button>
            <button onClick={() => setSummary((s) => !s)}>
              {summary ? "Vue immersive" : "Vue synthétique"}
            </button>
          </div>
        </div>
        <div className="layout">
          <div className="primary">
            {summary ? (
              <section className="summary" aria-label="Missions">
                <h2>
                  Le carnet des missions <small>{filtered.length}</small>
                </h2>
                {filtered.map((m) => (
                  <button
                    className="mission-row"
                    key={m.id}
                    onClick={() => choose(m)}
                  >
                    <span className={"dot " + m.status} />
                    <span>
                      <strong>{m.title}</strong>
                      <small>
                        {roles[m.agentRole]} ·{" "}
                        {
                          data?.projects.find((p) => p.id === m.projectId)
                            ?.label
                        }
                      </small>
                    </span>
                    <span>{statuses[m.status]}</span>
                  </button>
                ))}
              </section>
            ) : (
              <Garden
                missions={filtered}
                onSelect={choose}
                projects={data?.projects ?? []}
                onProject={setProject}
                animate={animate}
              />
            )}
            {filtered.length === 0 && (
              <p className="empty">
                {mode === "real" && connection === "loading"
                  ? "Lecture des traces…"
                  : missions.length
                    ? "Aucune mission ne correspond à ces filtres."
                    : "Le jardin est calme. Aucune activité connue à afficher."}
              </p>
            )}
            <div className="metrics">
              <div>
                <span>Les courants</span>
                <strong>
                  {active.length} <small>missions en cours connues</small>
                </strong>
              </div>
              <button
                onClick={() => {
                  setStatus("");
                  setSummary(true);
                }}
              >
                <span>Les récoltes</span>
                <strong>
                  {missions.filter((m) => m.status === "completed").length}{" "}
                  <small>opérations terminées</small>
                </strong>
              </button>
              <button
                onClick={() => {
                  setSummary(true);
                  setStatus(
                    issues.some((m) => m.status === "failed")
                      ? "failed"
                      : "blocked",
                  );
                }}
              >
                <span>Le compost</span>
                <strong>
                  {issues.length} <small>échecs ou blocages actuels</small>
                </strong>
              </button>
            </div>
            <section className="journal">
              <div className="section-head">
                <h2>Ce qui se passe au jardin</h2>
                <span>
                  {mode === "demo"
                    ? "Journal fictif"
                    : "Dernières traces conservées"}
                </span>
              </div>
              {[...(data?.events ?? [])]
                .filter(
                  (e) =>
                    (!project || e.projectId === project) &&
                    (!role || e.agentRole === role) &&
                    (!status || e.status === status),
                )
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 20)
                .map((e) => (
                  <div className="event" key={e.id}>
                    <time dateTime={e.timestamp}>
                      {new Date(e.timestamp).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <span className={"dot " + e.status} />
                    <span>{e.title}</span>
                    <small>
                      {statuses[e.status]}
                      {e.resultKind === "internal-cycle"
                        ? " · travail interne"
                        : ""}
                    </small>
                  </div>
                ))}
              {(data?.rejectedCount ?? 0) > 0 && (
                <p>
                  {data?.rejectedCount} entrées exclues : schéma, provenance ou
                  parcelle non reconnus.
                </p>
              )}
            </section>
          </div>
          <aside
            ref={inspector}
            tabIndex={-1}
            aria-label="Inspection d’une mission"
          >
            {chosen ? (
              <>
                <div className="aside-heading">
                  <span>LE CARNET D’UN GÉGÉ</span>
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="Fermer la mission"
                  >
                    ×
                  </button>
                </div>
                <div className="portrait">
                  <Gege role={chosen.agentRole} />
                </div>
                <h2>{roles[chosen.agentRole]}</h2>
                <h3>{chosen.title}</h3>
                <span className={"state " + chosen.status}>
                  {statuses[chosen.status]}
                </span>
                <p>
                  {chosen.errorMessage ??
                    (chosen.resultKind === "internal-cycle"
                      ? "Cette trace décrit un cycle interne. Elle ne confirme aucune publication extérieure."
                      : "L’état reflète uniquement les événements reçus.")}
                </p>
                {chosen.resultUrl && (
                  <a
                    href={chosen.resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ouvrir le résultat ↗
                  </a>
                )}
                {mode === "demo" && chosen.status !== "completed" && (
                  <button onClick={() => demoStep(chosen)}>
                    {["failed", "blocked"].includes(chosen.status)
                      ? "Simuler une reprise fictive"
                      : "Simuler une réussite fictive"}
                  </button>
                )}
                <dl>
                  <dt>Source</dt>
                  <dd>{chosen.sourceSystem}</dd>
                  <dt>Dernier événement</dt>
                  <dd>
                    {new Date(chosen.lastEventAt).toLocaleString("fr-FR")}
                  </dd>
                  <dt>Provenance</dt>
                  <dd>
                    {chosen.provenance === "demo"
                      ? "Fictive"
                      : "Trace réelle enregistrée"}
                  </dd>
                </dl>
                <details open>
                  <summary>
                    Historique de la mission ({chosen.history.length})
                  </summary>
                  {chosen.history.map((e) => (
                    <p key={e.id}>
                      <time>
                        {new Date(e.timestamp).toLocaleTimeString("fr-FR")}
                      </time>{" "}
                      · {statuses[e.status]}
                    </p>
                  ))}
                </details>
                <details>
                  <summary>Références techniques</summary>
                  <pre>
                    {JSON.stringify(
                      {
                        id: chosen.id,
                        sourceEventId: chosen.sourceEventId,
                        sourceRef: data?.sourceRef,
                        currentStep: chosen.currentStep,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </>
            ) : (
              <>
                <div className="aside-heading">
                  LE NOYAU DE GÉRARD <span>✧</span>
                </div>
                <div className="portrait">
                  <Gege chief />
                </div>
                <h2>
                  Chaque idée
                  <br />a sa saison.
                </h2>
                <p>
                  Gérard veille sur le jardin. Choisissez un petit jardinier
                  pour découvrir son travail et suivre ses traces.
                </p>
                <div className="note">
                  <strong>
                    {active.length
                      ? "Des missions sont en cours."
                      : "Un moment de calme."}
                  </strong>
                  <p>
                    {mode === "demo"
                      ? "Les mouvements illustrent des états fictifs fixes. Aucun minuteur ne fabrique de livraison."
                      : "Le calme n’est pas une panne. Les priorités et décisions en direct ne sont pas encore raccordées."}
                  </p>
                </div>
                <h3>Les sept métiers</h3>
                <div className="role-list">
                  {Object.entries(roles).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setRole(role === id ? "" : id)}
                      aria-pressed={role === id}
                    >
                      <i style={{ background: colors[id] }} />
                      {String(label)}
                    </button>
                  ))}
                </div>
                <p className="footnote">
                  Un métier représente une fonction existante, pas un agent
                  autonome supplémentaire.
                </p>
              </>
            )}
          </aside>
        </div>
      </main>
      <footer>
        <span>LE JARDIN DES GÉGÉ</span>
        <span>
          Prototype de travail · aucune publication ni commande de production
        </span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
