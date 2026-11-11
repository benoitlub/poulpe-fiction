import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, LayoutList, Maximize2, Minus, Pause, Play, Plus, Settings2 } from "lucide-react";
import { GardenScene, type SceneFilter } from "@/components/garden/GardenScene";
import { Inspector, Supervision } from "@/components/garden/Panels";
import { useCamera } from "@/components/garden/useCamera";
import { ROLE_VISUALS } from "@/garden-gege/roles";
import type { Selection } from "@/components/garden/scene-model";
import { configuredRealSource, demoSource } from "@/garden-gege/sources";
import { useGarden } from "@/garden-gege/useGarden";
import { useTentacleRuns } from "@/garden-gege/useTentacleRuns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Le Jardin des Gégé — Poulpe Fiction" },
      { name: "description", content: "Un jardin aquatique où les hamsters Gégé rendent visible le travail de Gérard." },
      { property: "og:title", content: "Le Jardin des Gégé" },
      { property: "og:description", content: "Pendant que les idées poussent, les Gégé s'occupent du jardin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Jardin,
});

export function Jardin() {
  // Real data is the default; ?source=demo explicitly enables fictional data.
  const [wantReal, setWantReal] = useState(true);
  useEffect(() => setWantReal(new URLSearchParams(location.search).get("source") !== "demo"), []);
  const source = useMemo(() => (wantReal ? configuredRealSource() : demoSource), [wantReal]);
  const garden = useGarden(source);
  const tentacles = useTentacleRuns(wantReal);
  const cam = useCamera();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [supervision, setSupervision] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [filter, setFilter] = useState<SceneFilter>("all");

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onVis = () => setPaused((p) => (document.hidden ? true : p));
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const select = (s: Selection) => {
    setSelection(s);
    setSupervision(false);
    if (s.kind === "role") cam.centerOn(ROLE_VISUALS[s.role].home.x, ROLE_VISUALS[s.role].home.y);
  };

  const active = garden.missions.filter((m) => ["running", "retrying"].includes(m.status)).length;
  const errors = garden.missions.filter((m) => ["failed", "blocked"].includes(m.status)).length;
  const isDemo = source?.kind === "demo";
  // Read-only visibility: never turn an old completed cycle into a live worker.
  const lastEvent = garden.events.at(-1);
  const lastPublication = [...garden.events].reverse().find(
    (event) => event.status === "completed" && event.resultKind === "publication",
  );
  const eventTime = (at?: string) => at
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(at))
    : "aucune trace";


  return (
    <main className={`fixed inset-0 overflow-hidden ${paused || reduced ? "garden-paused" : ""}`}>
      <div
        ref={cam.ref}
        className={`garden-stage absolute inset-0 ${cam.panning ? "is-panning" : ""}`}
        tabIndex={0}
        aria-label="Scène du jardin — glisser pour se déplacer"
        {...cam.handlers}
        onClick={() => setSelection(null)}
      >
        <div style={{ transform: `translate(${cam.cam.x}px, ${cam.cam.y}px) scale(${cam.cam.z})`, transformOrigin: "0 0", width: 1000, height: 700 }}>
          <GardenScene
            missions={garden.missions}
            projects={garden.snapshot?.projects ?? []}
            selection={selection}
            onSelect={select}
            reducedMotion={reduced}
            paused={paused}
            filter={filter}
          />
        </div>
      </div>

      {/* header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 md:p-5">
        <div className="min-w-0 flex-1 md:flex-none">
          <div className="glass-panel pointer-events-auto inline-block px-3 py-2 md:px-4 md:py-2.5">
            <h1 className="font-display text-base leading-tight font-extrabold md:text-xl">
              Le Jardin des <span className="text-gold-shine">Gégé</span>
            </h1>
            {isDemo ? <span className="demo-badge mt-1">Démonstration · données fictives</span>
              : <span className="garden-chip mt-1">Instantané réel</span>}
          </div>
          <div className="garden-filters pointer-events-auto mt-2 flex gap-1.5 overflow-x-auto" role="group" aria-label="Filtrer les Gégé">
            {([["all", `Tous · ${garden.missions.length}`], ["active", `En cours · ${active}`], ["attention", `À voir · ${errors}`]] as const).map(([k, label]) => (
              <button key={k} className="garden-chip glass-panel shrink-0 !py-1.5" aria-pressed={filter === k} onClick={() => setFilter(k)}
                style={filter === k ? { background: "var(--g-lagoon)", color: "var(--g-abyss)" } : undefined}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button className="garden-icon-btn" aria-label="Afficher l'activité" aria-expanded={activityOpen} onClick={() => { setActivityOpen(v => !v); setSettingsOpen(false); }}><Activity size={18} /></button>
          <button className="garden-btn glass-panel" aria-pressed={supervision} onClick={() => { setSupervision((v) => !v); setSelection(null); }}>
            <LayoutList size={16} /> <span className="hidden sm:inline">Superviser</span>
          </button>
          <button className="garden-icon-btn" aria-label="Réglages du jardin" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(v => !v)}><Settings2 size={18} /></button>
        </div>
      </header>

      {activityOpen && (
        <aside className="pointer-events-auto absolute left-2 right-2 top-20 z-30 max-h-[min(65dvh,520px)] overflow-y-auto rounded-xl md:left-auto md:right-5 md:top-24 md:w-[380px]" aria-label="Activité et tentacules">
          <div className="flex justify-end px-2 pt-2"><button className="garden-icon-btn" aria-label="Fermer l'activité" onClick={() => setActivityOpen(false)}>×</button></div>
            <div className="glass-panel pointer-events-auto mt-2 max-w-[min(92vw,340px)] px-3 py-2 text-xs leading-relaxed" aria-label="Dernières traces du jardin">
              <div className="font-semibold">Activité observée</div>
              <div>Dernière trace : {eventTime(lastEvent?.timestamp)}</div>
              <div>Dernière publication confirmée dans ce flux : {eventTime(lastPublication?.timestamp)}</div>
              <div className="text-muted-foreground">Source partielle · actualisation périodique · ne couvre pas tous les tentacules</div>
            </div>
            {!isDemo && (
              <div className="glass-panel pointer-events-auto mt-2 max-w-[min(92vw,340px)] px-3 py-2 text-xs leading-relaxed" aria-label="Exécutions GitHub des tentacules">
                <div className="font-semibold">Tentacules · GitHub Actions</div>
                {tentacles.length === 0 && <div>Lecture des exécutions…</div>}
                {tentacles.map((run) => (
                  <div key={run.name} className="flex items-center justify-between gap-2 py-0.5">
                    <span>{run.name}</span>
                    <span className="text-right">
                      {run.status === "unavailable" ? "Indisponible" :
                        run.status === "idle" ? "Aucune exécution" :
                        run.status === "in_progress" ? "En cours" :
                        run.status === "queued" ? "En attente" :
                        run.conclusion === "success" ? "Terminé ✓" :
                        run.conclusion === "failure" ? "Échec" :
                        run.conclusion === "cancelled" ? "Annulé" : "Terminé"}
                      {run.at ? ` · ${eventTime(run.at)}` : ""}
                      {run.url && <a href={run.url} target="_blank" rel="noopener noreferrer" className="ml-1 underline" aria-label={`Voir le run ${run.name}`}>Voir</a>}
                    </span>
                  </div>
                ))}
                <div className="text-muted-foreground">Exécution réussie ≠ publication confirmée. Source publique GitHub, rafraîchie chaque minute.</div>
              </div>
            )}
  
        </aside>
      )}
      {settingsOpen && (
        <section className="glass-panel pointer-events-auto absolute right-2 top-20 z-30 w-64 space-y-3 p-4 text-sm md:right-5 md:top-24" aria-label="Réglages du jardin">
          <div className="flex items-center justify-between"><strong>Réglages</strong><button aria-label="Fermer les réglages" onClick={() => setSettingsOpen(false)}>×</button></div>
          <button className="garden-btn w-full justify-center" onClick={() => setPaused(v => !v)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Reprendre la vie du jardin" : "Mettre les animations en pause"}</button>
          <label className="flex items-center gap-2"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} /> Réduire les animations</label>
          <p className="text-xs text-muted-foreground">La vie quotidienne est décorative ; les missions affichées restent fondées sur les événements réels.</p>
        </section>
      )}
      {garden.connection !== "snapshot" && (
        <div className="glass-panel absolute top-28 left-1/2 -translate-x-1/2 px-4 py-2 text-sm">
          {garden.connection === "loading" ? "Le jardin se réveille…" : garden.error}
        </div>
      )}

      {/* panels: right card on desktop, bottom sheet on mobile */}
      {(selection || supervision) && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 h-[min(70dvh,680px)] min-h-0 md:inset-x-auto md:top-24 md:right-5 md:bottom-5 md:h-auto md:w-[380px]">
          {supervision ? (
            <Supervision missions={garden.missions} events={garden.events} onClose={() => setSupervision(false)} onPickRole={(role) => select({ kind: "role", role })} />
          ) : selection ? (
            <Inspector selection={selection} missions={garden.missions} snapshot={garden.snapshot} onClose={() => setSelection(null)}
              onPickRole={(role) => select({ kind: "role", role })} {...(garden.addDemoTrace ? { addDemoTrace: garden.addDemoTrace } : {})} />
          ) : null}
        </div>
      )}

      {/* camera */}
      {!(selection || supervision) && (
        <div className="absolute right-3 bottom-3 flex flex-col gap-2 md:right-5 md:bottom-5">
          <button className="garden-icon-btn" onClick={() => cam.zoomBy(1.25)} aria-label="Zoomer"><Plus size={18} /></button>
          <button className="garden-icon-btn" onClick={() => cam.zoomBy(0.8)} aria-label="Dézoomer"><Minus size={18} /></button>
          <button className="garden-icon-btn" onClick={cam.fit} aria-label="Recentrer"><Maximize2 size={16} /></button>
        </div>
      )}
      {!(selection || supervision) && (
        <p className="pointer-events-none absolute bottom-4 left-4 max-w-[60%] text-xs text-muted-foreground">
          Touchez un Gégé ou Gérard le poulpe. Glissez pour explorer.
        </p>
      )}
    </main>
  );
}
