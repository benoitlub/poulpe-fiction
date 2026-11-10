import { X } from "lucide-react";
import type { GardenEvent, GardenMission, GardenSnapshot, MissionStatus } from "@/garden-gege/contracts";
import { roles as roleLabels, statuses } from "@/garden-gege/core.mjs";
import { ROLE_ORDER, ROLE_VISUALS } from "@/garden-gege/roles";
import { Hamster } from "./Hamster";
import { Octopus } from "./Octopus";
import { fmtTime, gerardMood, latestByRole, poseFor, STATUS_TONE, type Selection } from "./scene-model";

export function StatusPill({ status }: { status: MissionStatus }) {
  return (
    <span className="garden-chip">
      <span className="status-dot" style={{ background: STATUS_TONE[status] }} />
      {statuses[status]}
    </span>
  );
}

function Sheet({ title, kicker, onClose, children }: { title: string; kicker?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section className="garden-sheet glass-panel pointer-events-auto flex h-full min-h-0 max-h-full flex-col overflow-hidden" aria-label={title}>
      <header className="flex items-start justify-between gap-3 border-b px-5 pt-4 pb-3">
        <div>
          {kicker && <p className="text-[0.7rem] font-semibold tracking-widest text-lagoon uppercase">{kicker}</p>}
          <h2 className="font-display text-lg font-bold">{title}</h2>
        </div>
        <button className="garden-icon-btn !h-9 !w-9" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }} onTouchMove={(event) => event.stopPropagation()}>{children}</div>
    </section>
  );
}

function MissionCard({ m, onPick }: { m: GardenMission; onPick?: () => void }) {
  return (
    <button onClick={onPick} className="w-full rounded-xl border bg-glass p-3 text-left transition hover:border-lagoon/50">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{m.title}</span>
        <StatusPill status={m.status} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{roleLabels[m.agentRole]} · {fmtTime(m.lastEventAt)}</p>
    </button>
  );
}

function History({ events }: { events: GardenEvent[] }) {
  return (
    <ol className="space-y-2 border-l border-border pl-4">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative text-xs">
          <span className="status-dot absolute top-1 -left-[1.3rem]" style={{ background: STATUS_TONE[e.status] }} />
          <span className="font-semibold">{statuses[e.status]}</span>
          <span className="text-muted-foreground"> · {fmtTime(e.timestamp)} · {e.sourceSystem}</span>
        </li>
      ))}
    </ol>
  );
}

interface InspectorProps {
  selection: Selection;
  missions: GardenMission[];
  snapshot: GardenSnapshot | null;
  onClose: () => void;
  onPickRole: (r: GardenMission["agentRole"]) => void;
  addDemoTrace?: (missionId: string, status: MissionStatus) => void;
}

export function Inspector({ selection, missions, snapshot, onClose, onPickRole, addDemoTrace }: InspectorProps) {
  if (selection.kind === "role") {
    const v = ROLE_VISUALS[selection.role];
    const m = latestByRole(missions)[selection.role];
    return (
      <Sheet title={v.label} kicker={`Gégé · ${v.place}`} onClose={onClose}>
        <div className="flex items-center gap-4">
          <svg viewBox="-45 -115 90 120" className="h-24 w-20 shrink-0" aria-hidden>
            <Hamster role={selection.role} pose={poseFor(m, selection.role)} tone={v.tone} still={!v.animated} />
          </svg>
          <p className="text-sm text-muted-foreground">{v.craft}</p>
        </div>
        {!v.animated && <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">Gestuelle complète à venir. L'état affiché est celui observé.</p>}
        {m ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{m.title}</h3><StatusPill status={m.status} /></div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-muted-foreground">Étape</dt><dd>{m.currentStep}</dd>
              <dt className="text-muted-foreground">Dernier signe</dt><dd>{fmtTime(m.lastEventAt)}</dd>
              <dt className="text-muted-foreground">Source</dt><dd>{m.sourceSystem} {m.provenance === "demo" && <span className="text-orchid">(fictif)</span>}</dd>
            </dl>
            {m.errorMessage && <p className="text-xs text-orchid">{m.errorMessage}</p>}
            {m.resultUrl && <a href={m.resultUrl} target="_blank" rel="noreferrer" className="garden-btn">Voir le résultat</a>}
            <h4 className="pt-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Historique observé</h4>
            <History events={m.history} />
            {addDemoTrace && (
              <div className="rounded-xl border border-dashed border-orchid/60 p-3">
                <p className="mb-2 text-xs font-semibold text-orchid">Démo · ajouter une trace fictive</p>
                <div className="flex flex-wrap gap-2">
                  {(["running", "completed", "failed", "retrying"] as MissionStatus[]).map((s) => (
                    <button key={s} className="garden-btn !min-h-8 !text-xs" onClick={() => addDemoTrace(m.id, s)}>{statuses[s]}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Au repos : aucune mission observée pour ce métier.</p>
        )}
      </Sheet>
    );
  }
  if (selection.kind === "gerard") {
    const recent = missions.flatMap((m) => m.history).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8);
    const phases = (Object.keys(statuses) as MissionStatus[]).map((s) => ({ s, n: missions.filter((m) => m.status === s).length })).filter((p) => p.n > 0);
    return (
      <Sheet title="Gérard" kicker="Poulpe coordinateur · Le Noyau" onClose={onClose}>
        <div className="flex items-center gap-4">
          <svg viewBox="-70 -100 140 115" className="h-24 w-28 shrink-0" aria-hidden>
            <Octopus mood={gerardMood(missions)} />
          </svg>
          <p className="text-sm text-muted-foreground">Gérard coordonne le jardin depuis le Noyau. Il ne montre que ce que les sources ont réellement enregistré.</p>
        </div>
        <h4 className="mt-4 mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Phases observées</h4>
        {phases.length ? (
          <div className="flex flex-wrap gap-1.5">
            {phases.map((p) => <span key={p.s} className="garden-chip"><span className="status-dot" style={{ background: STATUS_TONE[p.s] }} />{statuses[p.s]} · {p.n}</span>)}
          </div>
        ) : <p className="text-sm">Aucune mission observée.</p>}
        {snapshot && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <dt className="text-muted-foreground">Instantané</dt><dd>{fmtTime(snapshot.generatedAt)}</dd>
            <dt className="text-muted-foreground">Référence</dt><dd>{snapshot.sourceRef}</dd>
            <dt className="text-muted-foreground">Couverture</dt><dd>Partielle</dd>
            <dt className="text-muted-foreground">Rejetés</dt><dd>{snapshot.rejectedCount}</dd>
          </dl>
        )}
        <h4 className="mt-4 mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Activité récente</h4>
        <History events={[...recent].reverse()} />
      </Sheet>
    );
  }
  if (selection.kind === "parcel") {
    const p = snapshot?.projects.find((x) => x.id === selection.projectId);
    const list = missions.filter((m) => m.projectId === selection.projectId);
    return (
      <Sheet title={p?.label ?? "Parcelle"} kicker="Parcelle" onClose={onClose}>
        <p className="mb-3 text-sm text-muted-foreground">{list.length} mission(s) observée(s) sur cette parcelle.</p>
        <div className="space-y-2">{list.map((m) => <MissionCard key={m.id} m={m} onPick={() => onPickRole(m.agentRole)} />)}</div>
      </Sheet>
    );
  }
  const failed = missions.filter((m) => m.status === "failed");
  return (
    <Sheet title="Compost du Feuch" kicker="Recyclage des erreurs" onClose={onClose}>
      <p className="mb-3 text-sm text-muted-foreground">Les tentatives ratées viennent nourrir le compost. Rien ne s'y perd : l'historique est conservé.</p>
      {failed.length ? <div className="space-y-2">{failed.map((m) => <MissionCard key={m.id} m={m} onPick={() => onPickRole(m.agentRole)} />)}</div>
        : <p className="text-sm">Le compost est calme.</p>}
    </Sheet>
  );
}

export function Supervision({ missions, events, onClose, onPickRole }: { missions: GardenMission[]; events: GardenEvent[]; onClose: () => void; onPickRole: (r: GardenMission["agentRole"]) => void }) {
  const groups: { label: string; list: GardenMission[] }[] = [
    { label: "Missions actives", list: missions.filter((m) => ["running", "retrying", "queued"].includes(m.status)) },
    { label: "Erreurs et blocages", list: missions.filter((m) => ["failed", "blocked"].includes(m.status)) },
    { label: "Terminées", list: missions.filter((m) => m.status === "completed") },
  ];
  const pubs = missions.filter((m) => m.resultKind === "publication");
  const projects = new Set(missions.map((m) => m.projectId));
  return (
    <Sheet title="Supervision" kicker="Vue d'ensemble" onClose={onClose}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {groups.map((g) => (
          <div key={g.label} className="rounded-xl bg-muted/50 p-2">
            <p className="font-display text-xl font-bold">{g.list.length}</p>
            <p className="text-[0.65rem] text-muted-foreground">{g.label}</p>
          </div>
        ))}
      </div>
      {groups.map((g) => g.list.length > 0 && (
        <div key={g.label} className="mb-4">
          <h3 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{g.label}</h3>
          <div className="space-y-2">{g.list.map((m) => <MissionCard key={m.id} m={m} onPick={() => onPickRole(m.agentRole)} />)}</div>
        </div>
      ))}
      <h3 className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Publications</h3>
      <p className="mb-4 text-sm">{pubs.length ? `${pubs.length} publication(s) vérifiée(s)` : "Aucune publication observée."}</p>
      <h3 className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Projets concernés</h3>
      <p className="mb-4 text-sm">{projects.size}</p>
      <h3 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Les sept métiers</h3>
      <div className="flex flex-wrap gap-1.5">
        {ROLE_ORDER.map((r) => (
          <button key={r} className="garden-chip" onClick={() => onPickRole(r)}>
            <span className="status-dot" style={{ background: ROLE_VISUALS[r].tone }} />{ROLE_VISUALS[r].label}
          </button>
        ))}
      </div>
      <h3 className="mt-4 mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Activité de Gérard</h3>
      <p className="text-sm">{events.length} trace(s) dans cette session.</p>
    </Sheet>
  );
}
