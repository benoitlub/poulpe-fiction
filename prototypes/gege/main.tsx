import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  GardenMission,
  GardenMode,
} from "../../src/garden-gege/contracts";
import {
  roles,
  statuses,
  projectMissions,
} from "../../src/garden-gege/core.mjs";
import { demoSnapshot } from "./demo";
import "./style.css";
import { useGardenFeed } from "../../src/garden-gege/useGardenFeed";
import { Gege, roleColors as colors } from "./Gege";
import { Gerard } from "./Gerard";
import { Garden } from "./Garden";
function App() {
  const [demoData, setDemoData] = useState(demoSnapshot);
  const [mode, setMode] = useState<GardenMode>("real");
  const { snapshot, connection, refresh } = useGardenFeed(mode);
  const [project, setProject] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [animate, setAnimate] = useState(true);
  const inspector = useRef<HTMLElement>(null);
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
        <div className="gege-header-actions">
          <a href="../mobile-v2.html">← Retour au Garden</a>
          <span className="prototype">EXPLORATION · PROTOTYPE ISOLÉ</span>
        </div>
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
                Sept hamsters spécialisés en démonstration. Aucune mission
                réelle n’est exécutée.
              </span>
            </>
          ) : (
            <>
              <strong>
                {connection === "loading"
                  ? "CHARGEMENT"
                  : connection === "connected"
                    ? "LECTURE CONNECTÉE"
                    : connection === "partial"
                      ? "SOURCES PARTIELLES"
                      : connection === "invalid"
                        ? "RÉPONSE INVALIDE"
                        : "HORS LIGNE"}
              </strong>
              <span>
                {snapshot
                  ? `Sources relues le ${new Date(snapshot.generatedAt).toLocaleString("fr-FR")}. Actualisation chaque minute · historique partiel. Dernière trace : ${snapshot.events.length ? new Date(Math.max(...snapshot.events.map((e) => Date.parse(e.timestamp)))).toLocaleString("fr-FR") : "aucune"}.`
                  : "Aucun instantané disponible. Le jardin attend sa source."}
              </span>
              <button onClick={refresh}>Relire</button>
              {snapshot?.sources?.map((source) => (
                <span key={source.id}>
                  {source.id} :{" "}
                  {source.state === "available" ? "lisible" : "indisponible"}
                </span>
              ))}
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
                onCoordinator={() => {
                  setSelected(null);
                  requestAnimationFrame(() => inspector.current?.focus());
                }}
                projects={data?.projects ?? []}
                onProject={setProject}
                animate={
                  animate && (mode === "demo" || connection === "connected")
                }
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
                  <dt>Résultat observé</dt>
                  <dd>
                    {chosen.resultKind === "harvest"
                      ? "Récolte enregistrée via Octopus et Publisher"
                      : chosen.resultKind === "publication"
                        ? "Publication enregistrée"
                        : chosen.resultKind === "internal-cycle"
                          ? "Cycle interne — aucune diffusion déduite"
                          : "Aucun résultat renseigné"}
                  </dd>
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
                  <Gerard />
                </div>
                <h2>
                  Chaque idée
                  <br />a sa saison.
                </h2>
                <p>
                  Gérard le poulpe coordonne le jardin. Les Gégé, petits
                  hamsters, représentent les sept métiers. Choisissez un Gégé
                  pour découvrir son métier et suivre ses traces.
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
                      : "Le calme n’est pas une panne. Les sources sont relues périodiquement ; leur absence d’activité ne prouve pas une panne."}
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
        <a href="../mobile-v2.html">Retour à Poulpe Fiction</a>
        <span>
          Prototype de travail · aucune publication ni commande de production
        </span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
