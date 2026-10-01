import { useEffect, useMemo, useState } from "react";
import { QuestionStep } from "../components/QuestionStep";
import type { PoulpeRuntimeAdapter } from "../runtime/PoulpeRuntimeAdapter";
import { poulpeStore, usePoulpeStore } from "../store";
import type { Parcel } from "../types";

const GOALS = ["Un visuel Instagram", "Une liste de contacts", "Une landing page", "Un post LinkedIn"];
const AUDIENCES = ["Notre communauté", "Nouveaux prospects", "Partenaires", "Presse"];
const FORMATS = ["Court et impactant", "Chaleureux et long", "Structuré et professionnel"];
const SELECTED_PARCEL_KEY = "poulpe-fiction:mobile-v2:selected-parcel:v1";
const TOOL_PACK_KEY_PREFIX = "poulpe-fiction:mobile-v2:tool-pack:v1:";

type UnknownRecord = Record<string, unknown>;

declare global {
  interface Window {
    PoulpeAccess?: { snapshot(): UnknownRecord };
  }
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function slugify(value: string): string {
  return value
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/-+/g, "-")
    .slice(0, 60) || `projet-${Date.now()}`;
}

function ownerParcels(): Parcel[] {
  const access = window.PoulpeAccess?.snapshot?.() ?? {};
  if (access.mode === "client") return [];
  return (window.GardenStore?.snapshot?.().parcels ?? [])
    .filter((parcel) => !parcel.archived)
    .map((parcel) => ({
      id: text(parcel.id),
      name: text(parcel.name) || text(parcel.id),
      description: text(parcel.mission) || text(parcel.description) || "Parcelle confiée à Gérard",
      emoji: "🌱",
    }))
    .filter((parcel) => Boolean(parcel.id));
}

function mergeParcels(scoped: Parcel[], available: Parcel[]): Parcel[] {
  const merged = new Map<string, Parcel>();
  [...available, ...scoped].forEach((parcel) => merged.set(parcel.id, parcel));
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function NewProjectForm({ onCreated, onCancel }: { onCreated: (parcelId: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [firstGoal, setFirstGoal] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const cleanName = name.trim();
    const cleanMission = mission.trim();
    if (!cleanName || !cleanMission) {
      setError("Le nom et l'objectif du projet sont nécessaires.");
      return;
    }
    if (!window.GardenStore) {
      setError("Le Garden n'est pas chargé — recharge la page et réessaie.");
      return;
    }
    const existing = (window.GardenStore.snapshot().parcels ?? []) as Array<{ id?: string }>;
    let id = slugify(cleanName);
    let suffix = 2;
    while (existing.some((parcel) => parcel.id === id)) id = `${slugify(cleanName)}-${suffix++}`;

    const seeds = firstGoal.trim() ? [{
      id: `${id}-seed-1`,
      parcelId: id,
      title: firstGoal.trim(),
      objective: firstGoal.trim(),
      status: "planted",
    }] : [];

    window.GardenStore.registerParcel({
      id,
      code: id.toUpperCase().slice(0, 12),
      name: cleanName,
      mission: cleanMission,
      priorities: firstGoal.trim() ? [firstGoal.trim()] : [],
      version: 1,
      seeds,
    });

    onCreated(id);
  };

  return (
    <section className="pf-card">
      <div className="pf-section-heading"><span>+</span><div><strong>Nouveau projet</strong><small>Crée une parcelle pour que Gérard puisse y travailler</small></div></div>
      <label className="pf-field-label">Nom du projet</label>
      <input className="pf-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex : Metaverse Creator" autoFocus />
      <label className="pf-field-label">Objectif de ce projet</label>
      <textarea className="pf-textarea" value={mission} onChange={(event) => setMission(event.target.value)} placeholder="Ce que ce projet doit accomplir globalement…" />
      <label className="pf-field-label">Première graine à planter (facultatif)</label>
      <textarea className="pf-textarea" value={firstGoal} onChange={(event) => setFirstGoal(event.target.value)} placeholder="Un premier résultat concret à viser…" />
      {error ? <p className="pf-meta" style={{ color: "#e08fd0" }}>{error}</p> : null}
      <div className="pf-actions" style={{ justifyContent: "flex-end", gap: "8px" }}>
        <button type="button" className="pf-btn pf-btn-soft" onClick={onCancel}>Annuler</button>
        <button type="button" className="pf-btn pf-btn-primary" onClick={submit}>Créer le projet</button>
      </div>
    </section>
  );
}

export function GerardScreen({ runtime, onSubmit }: { runtime: PoulpeRuntimeAdapter; onSubmit: () => void }) {
  const clientContext = usePoulpeStore((state) => state.clientContext);
  const parcels = usePoulpeStore((state) => state.parcels);
  const answers = usePoulpeStore((state) => state.answers);
  const missionId = usePoulpeStore((state) => state.missionId);
  const progress = usePoulpeStore((state) => state.progress);
  const harvest = usePoulpeStore((state) => state.harvest);
  const [creatingProject, setCreatingProject] = useState(false);
  const [missionComposerOpen, setMissionComposerOpen] = useState(false);
  const [gardenRevision, setGardenRevision] = useState(0);
  const [toolPack, setToolPack] = useState<UnknownRecord | null>(null);
  const [toolPackStatus, setToolPackStatus] = useState<string>("");
  const [toolPackLoading, setToolPackLoading] = useState(false);
  // Gérard travaille en autonomie : rouvrir ce cockpit ne devrait pas
  // redemander de choisir une parcelle parmi toutes celles du Garden. La
  // grille complète ne s'ouvre donc qu'à la demande — sauf quand aucun projet
  // n'est encore sélectionné, où il faut bien pouvoir en désigner un.
  const [pickingParcel, setPickingParcel] = useState(false);

  const refreshParcels = () => {
    Promise.all([runtime.getClientContext(), runtime.listParcels()]).then(([context, scopedParcels]) => {
      const availableParcels = mergeParcels(scopedParcels, ownerParcels());
      poulpeStore.setClientContext(context);
      poulpeStore.setParcels(availableParcels);
      return availableParcels;
    });
  };

  useEffect(() => {
    let alive = true;
    Promise.all([runtime.getClientContext(), runtime.listParcels()]).then(([context, scopedParcels]) => {
      if (!alive) return;
      const availableParcels = mergeParcels(scopedParcels, ownerParcels());
      poulpeStore.setClientContext(context);
      poulpeStore.setParcels(availableParcels);
      const storedParcelId = localStorage.getItem(SELECTED_PARCEL_KEY) ?? "";
      const preferredId = context?.parcelId || (availableParcels.some((parcel) => parcel.id === storedParcelId) ? storedParcelId : "");
      if (preferredId) poulpeStore.setAnswer("parcelId", preferredId);
    });
    const onGardenChanged = () => { refreshParcels(); setGardenRevision((revision) => revision + 1); };
    window.addEventListener("poulpe-garden-changed", onGardenChanged);
    return () => { alive = false; window.removeEventListener("poulpe-garden-changed", onGardenChanged); };
  }, [runtime]);

  const selectedParcel = useMemo(() => parcels.find((parcel) => parcel.id === answers.parcelId), [parcels, answers.parcelId]);

  useEffect(() => {
    if (!answers.parcelId) { setToolPack(null); setToolPackStatus(""); return; }
    try {
      const raw = localStorage.getItem(`${TOOL_PACK_KEY_PREFIX}${answers.parcelId}`);
      setToolPack(raw ? JSON.parse(raw) as UnknownRecord : null);
      setToolPackStatus(raw ? "Tool Pack restauré pour ce projet." : "");
    } catch (_) { setToolPack(null); setToolPackStatus(""); }
  }, [answers.parcelId]);
  const runtimeQuestion = progress?.state === "needs-input" ? progress.question : undefined;
  const ready = Boolean(answers.parcelId && answers.goal?.trim());
  const activeMission = Boolean(missionId && progress && !progress.finished);

  const prepareResources = async () => {
    if (!selectedParcel) return;
    const publisherApi = text((window as unknown as { PoulpeRuntimeConfig?: { urls?: { publisherApi?: string } } }).PoulpeRuntimeConfig?.urls?.publisherApi);
    if (!publisherApi) { setToolPackStatus("Publisher n’est pas configuré."); return; }
    setToolPackLoading(true); setToolPackStatus("");
    try {
      const operationId = `tool-pack-${selectedParcel.id}-${Date.now()}`;
      const garden = window.GardenStore?.snapshot?.();
      const parcel = garden?.parcels?.find((item) => text(item.id) === selectedParcel.id);
      const parcelSeeds = (parcel?.seeds ?? []).slice(-5).map((seed) => ({
        id: text(seed.id),
        title: text(seed.title),
        objective: text(seed.objective),
        status: text(seed.status),
      }));
      const parcelHarvests = (garden?.harvests ?? []).filter((item) => text(item.parcelId) === selectedParcel.id).slice(-5).map((item) => ({
        id: text(item.id),
        title: text(item.title),
        createdAt: text(item.createdAt) || text(item.completedAt),
      }));
      const parcelOperations = (garden?.operations ?? []).filter((item) => text(item.parcelId) === selectedParcel.id).slice(-5).map((item) => ({
        id: text(item.id),
        capability: text(item.capability),
        status: text(item.status),
      }));
      const parcelCompost = (garden?.compost ?? []).filter((item) => text(item.parcelId) === selectedParcel.id).slice(-3).map((item) => ({
        id: text(item.id),
        reason: text(item.reason) || text(item.title),
      }));
      const response = await fetch(`${publisherApi.replace(/\/+$/, "")}/api/octopus-adapter/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract: "octopus-adapter-execution-v1",
          adapterId: "publisher",
          mission: {
            operationId,
            title: `Préparer les ressources — ${selectedParcel.name}`,
            objective: answers.goal || selectedParcel.description || "Préparer les outils utiles à cette parcelle.",
            requiredCapabilities: ["tool.search"],
            context: {
              id: selectedParcel.id,
              label: selectedParcel.name,
              objective: selectedParcel.description,
              metadata: {
                parcelId: selectedParcel.id,
                seedId: parcelSeeds.at(-1)?.id || selectedParcel.id,
                deliverable: answers.goal || selectedParcel.description || "",
                gardenContext: {
                  contract: "garden-context-v1",
                  parcel: { id: selectedParcel.id, name: selectedParcel.name, objective: selectedParcel.description },
                  seeds: parcelSeeds,
                  recentHarvests: parcelHarvests,
                  recentOperations: parcelOperations,
                  recentCompost: parcelCompost,
                },
              },
            },
          },
        }),
      });
      const result = await response.json() as UnknownRecord;
      const status = text(result.status);
      const output = result.output && typeof result.output === "object" ? result.output as UnknownRecord : {};
      if (response.ok && status === "completed") {
        setToolPack(output);
        try { localStorage.setItem(`${TOOL_PACK_KEY_PREFIX}${selectedParcel.id}`, JSON.stringify(output)); } catch (_) {}
        setToolPackStatus(text(result.summary) || "Ressources préparées.");
      } else {
        setToolPack(null);
        setToolPackStatus(text(result.summary) || `Publisher : ${status || response.status}`);
      }
    } catch (error) {
      setToolPack(null);
      setToolPackStatus(error instanceof Error ? error.message : "Impossible de préparer les ressources.");
    } finally { setToolPackLoading(false); }
  };

  const setParcel = (parcelId: string) => {
    poulpeStore.setAnswer("parcelId", parcelId);
    setPickingParcel(false);
    try { localStorage.setItem(SELECTED_PARCEL_KEY, parcelId); } catch (_) {}
  };

  if (runtimeQuestion) {
    const isChoice = runtimeQuestion.inputType === "choice" && runtimeQuestion.options?.length;
    return (
      <QuestionStep eyebrow="Décision requise" title={runtimeQuestion.label} hint={runtimeQuestion.reason} canBack={false} canNext={false} onNext={() => undefined}>
        {isChoice ? (
          <div>{runtimeQuestion.options!.map((option) => (
            <button key={option} type="button" className="pf-parcel" onClick={async () => {
              const next = await runtime.answerQuestion(runtimeQuestion.missionId, runtimeQuestion.id, option);
              poulpeStore.setProgress(next);
              poulpeStore.setTab("hublot");
            }}><span><div className="pf-parcel-name">{option}</div></span><span className="pf-parcel-arrow" aria-hidden>→</span></button>
          ))}</div>
        ) : (
          <form onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const answer = String(data.get("answer") ?? "").trim();
            const next = await runtime.answerQuestion(runtimeQuestion.missionId, runtimeQuestion.id, answer);
            poulpeStore.setProgress(next);
            poulpeStore.setTab("hublot");
          }}>
            {runtimeQuestion.inputType === "long-text" ? <textarea name="answer" className="pf-textarea" autoFocus /> : <input name="answer" type={runtimeQuestion.inputType === "url" ? "url" : "text"} className="pf-input" autoFocus />}
            <div className="pf-actions" style={{ justifyContent: "flex-end" }}><button className="pf-btn pf-btn-primary" type="submit">Répondre</button></div>
          </form>
        )}
      </QuestionStep>
    );
  }

  const gardenSnapshot = useMemo(() => window.GardenStore?.snapshot?.(), [gardenRevision, parcels]);
  const persistentHarvests = gardenSnapshot?.harvests ?? [];
  const persistentOperations = gardenSnapshot?.operations ?? [];
  const persistentCompost = gardenSnapshot?.compost ?? [];
  const maturityAudit = useMemo(() => {
    const audit = (window.GardenStore as unknown as { auditHarvestMaturity?: () => UnknownRecord } | undefined)?.auditHarvestMaturity?.();
    return audit && typeof audit === "object" ? audit : null;
  }, [gardenRevision, persistentHarvests.length, persistentOperations.length]);
  const maturityCounts = maturityAudit?.counts && typeof maturityAudit.counts === "object" ? maturityAudit.counts as UnknownRecord : {};
  const keepCount = Number(maturityCounts.keep ?? 0);
  const recycleCount = Number(maturityCounts["recycle-candidate"] ?? 0);
  const compostCandidateCount = Number(maturityCounts["compost-candidate"] ?? 0);
  const maturityItems = Array.isArray(maturityAudit?.items) ? maturityAudit.items as UnknownRecord[] : [];
  const maturityCandidates = maturityItems
    .filter((item) => item.disposition === "recycle-candidate" || item.disposition === "compost-candidate")
    .sort((a, b) => Number(b.ageDays ?? 0) - Number(a.ageDays ?? 0))
    .slice(0, 6);
  const recentGardenActivity = useMemo(() => {
    const harvestRows = persistentHarvests.slice(-4).map((item) => ({
      id: `harvest-${item.id}`,
      kind: "Récolte",
      title: text(item.title) || text(item.id) || "Récolte",
      at: text(item.createdAt) || text(item.updatedAt),
    }));
    const operationRows = persistentOperations.slice(-4).map((item) => ({
      id: `operation-${item.id}`,
      kind: "Mission",
      title: text(item.label) || text(item.summary) || text(item.capability) || text(item.id) || "Opération",
      at: text(item.updatedAt) || text(item.createdAt),
    }));
    return [...harvestRows, ...operationRows]
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
      .slice(0, 5);
  }, [persistentHarvests, persistentOperations]);

  const completedHarvests = harvest ? 1 : 0;
  const decisionCount = progress?.state === "needs-input" || progress?.blocked ? 1 : 0;
  const statusLabel = activeMission ? "en travail" : harvest ? "récolte prête" : "en veille";
  const [recycleStatus, setRecycleStatus] = useState<string | null>(null);

  const replantHarvest = (item: UnknownRecord) => {
    const harvestId = text(item.harvestId);
    const parcelId = text(item.parcelId);
    if (!harvestId || !parcelId || !window.GardenStore?.recycleHarvest) {
      setRecycleStatus("Impossible de replanter cette récolte : le Garden n’est pas prêt.");
      return;
    }
    try {
      const seed = window.GardenStore.recycleHarvest({ harvestId, parcelId });
      setRecycleStatus(`Récolte replantée en Seed « ${text((seed as UnknownRecord)?.title) || text((seed as UnknownRecord)?.id) || "recyclée"} ».`);
    } catch (error) {
      setRecycleStatus(error instanceof Error ? error.message : "Le recyclage a échoué.");
    }
  };

  return (
    <div className="pf-cockpit">
      <section className="pf-gerard-focus">
        <div className="pf-gerard-presence"><span className={activeMission ? "is-live" : ""} /><div><small>Gérard · {statusLabel}</small><strong>{progress?.blocked ? "J’ai besoin d’une décision." : activeMission && progress ? progress.label : harvest ? "Une récolte est prête." : selectedParcel ? `Je veille sur ${selectedParcel.name}.` : "Quel projet veux-tu faire avancer ?"}</strong><p>{progress?.blocked?.reason || (activeMission && progress ? progress.description : harvest ? harvest.harvest.title : selectedParcel?.description || "Choisis une parcelle ou confie-moi directement une intention.")}</p></div></div>
        <button type="button" className="pf-btn pf-btn-primary pf-gerard-action" onClick={() => setMissionComposerOpen((open) => !open)}>{missionComposerOpen ? "Fermer" : "Confier une intention"}</button>
      </section>
      <div className="pf-gerard-stats" aria-label="Résumé du Garden"><span>{parcels.length} projets</span><span>{persistentHarvests.length || completedHarvests} récoltes</span>{decisionCount ? <span className="is-attention">{decisionCount} décision</span> : <span>Aucune décision en attente</span>}</div>

      <details className="pf-card pf-secondary-panel">
        <summary><span>Capital du Garden</span><small>{recycleCount} à recycler · {compostCandidateCount} à composter</small></summary>
        {maturityAudit ? <div className="pf-live-work">
          <div className="pf-chips">
            <span className="pf-chip" data-selected>À conserver · {keepCount}</span>
            <span className="pf-chip">À recycler · {recycleCount}</span>
            <span className="pf-chip">Compost candidates · {compostCandidateCount}</span>
            <span className="pf-chip">Compost existant · {persistentCompost.length}</span>
          </div>
          {maturityCandidates.length ? <div className="pf-project-grid">{maturityCandidates.map((item) => {
            const disposition = text(item.disposition);
            const reasons = Array.isArray(item.reasons) ? item.reasons.map(text).filter(Boolean) : [];
            return <div key={text(item.harvestId)} className="pf-project-choice">
              <span className="pf-emoji">{disposition === "recycle-candidate" ? "♻" : "🍂"}</span>
              <span><b>{text(item.title) || text(item.harvestId) || "Récolte"}</b><small>{disposition === "recycle-candidate" ? "Recycler" : "Composter"} · {Number(item.ageDays ?? 0)} j · {reasons[0] || "raison déterministe"}</small></span>
              {disposition === "recycle-candidate" ? <button type="button" className="pf-btn pf-btn-soft" onClick={() => replantHarvest(item)}>Replanter</button> : null}
            </div>;
          })}</div> : <p className="pf-meta">Aucun candidat au recyclage ou au compostage avec les critères actuels.</p>}
          {recycleStatus ? <p className="pf-meta">{recycleStatus}</p> : null}
          <p className="pf-meta">Gérard privilégie la conservation en cas de doute. Le recyclage reste volontaire à ce stade.</p>
        </div> : <div className="pf-live-empty"><span>Le diagnostic de maturation n’est pas disponible.</span></div>}
      </details>

      <section className="pf-card pf-now-card">
        <div className="pf-section-heading"><span>●</span><div><strong>Maintenant</strong><small>État réel du travail de Gérard</small></div></div>
        {activeMission && progress ? <div className="pf-live-work"><div className="pf-now-row"><div><b>{progress.label}</b><small>{progress.description || "Mission en cours"}</small></div><button type="button" className="pf-btn pf-btn-soft" onClick={() => poulpeStore.setTab("hublot")}>Voir</button></div><div className="pf-progress"><div style={{ width: `${Math.round(progress.progress * 100)}%` }} /></div></div>
        : harvest ? <div className="pf-now-row"><div><b>{harvest.harvest.title}</b><small>Dernière récolte prête à être utilisée</small></div><button type="button" className="pf-btn pf-btn-soft" onClick={() => poulpeStore.setTab("harvest")}>Ouvrir</button></div>
        : <div className="pf-live-empty"><strong>Le jardin veille.</strong><span>Aucune mission active pour le moment.</span></div>}
        {progress?.blocked ? <div className="pf-live-alert"><strong>Décision requise</strong><span>{progress.blocked.reason}</span></div> : null}
      </section>

      <section className="pf-card">
        <div className="pf-section-heading"><span>🌱</span><div><strong>Projet actif</strong><small>La parcelle actuellement au premier plan</small></div></div>
        {selectedParcel ? <button type="button" className="pf-project-choice" data-selected onClick={() => { setPickingParcel(true); setMissionComposerOpen(true); }}><span className="pf-emoji">{selectedParcel.emoji ?? "🌱"}</span><span><b>{selectedParcel.name}</b><small>{selectedParcel.description}</small></span></button> : <div className="pf-live-empty"><span>Aucun projet sélectionné.</span></div>}
        <div className="pf-actions-row"><button type="button" className="pf-btn pf-btn-soft" onClick={() => { setPickingParcel(true); setMissionComposerOpen(true); }}>Changer de projet</button><button type="button" className="pf-btn pf-btn-soft" onClick={() => { setCreatingProject(true); setMissionComposerOpen(true); }}>+ Nouveau projet</button></div>
      </section>

      <details className="pf-card pf-secondary-panel">
        <summary><span>Ressources</span><small>{toolPack ? "Préparées pour ce projet" : "À préparer si nécessaire"}</small></summary>
        {toolPack ? <div className="pf-live-work">
          <div className="pf-now-row"><div><b>{text(toolPack.name) || text(toolPack.title) || "Tool Pack"}</b><small>{Array.isArray(toolPack.tools) ? `${toolPack.tools.length} outil(s) recommandé(s)` : "Ressources préparées"}</small></div></div>
          {Array.isArray(toolPack.tools) ? <div className="pf-chips">{toolPack.tools.slice(0, 8).map((tool, index) => {
            const row = tool && typeof tool === "object" ? tool as UnknownRecord : {};
            return <span key={text(row.id) || text(row.slug) || String(index)} className="pf-chip" data-selected>{text(row.name) || text(row.slug) || text(row.id) || "Outil"}</span>;
          })}</div> : null}
        </div> : <div className="pf-live-empty"><span>Aucun Tool Pack préparé pour ce projet.</span></div>}
        {toolPackStatus ? <p className="pf-meta">{toolPackStatus}</p> : null}
        <div className="pf-actions-row"><button type="button" className="pf-btn pf-btn-soft" disabled={!selectedParcel || toolPackLoading} onClick={prepareResources}>{toolPackLoading ? "Préparation…" : "Préparer les ressources"}</button></div>
      </details>

      {missionComposerOpen ? <>
        <section className="pf-card pf-composer-card">
          <div className="pf-section-heading"><span>1</span><div><strong>Projet</strong><small>La parcelle concernée</small></div></div>
          {selectedParcel && !pickingParcel ? <button type="button" className="pf-project-choice" data-selected onClick={() => setPickingParcel(true)}><span className="pf-emoji">{selectedParcel.emoji ?? "🌱"}</span><span><b>{selectedParcel.name}</b><small>{selectedParcel.description}</small></span></button> : <div className="pf-project-grid">{parcels.map((parcel) => <button key={parcel.id} type="button" className="pf-project-choice" data-selected={answers.parcelId === parcel.id} onClick={() => setParcel(parcel.id)}><span className="pf-emoji">{parcel.emoji ?? "🌱"}</span><span><b>{parcel.name}</b><small>{parcel.description}</small></span></button>)}</div>}
          {creatingProject ? <NewProjectForm onCancel={() => setCreatingProject(false)} onCreated={(parcelId) => { setCreatingProject(false); refreshParcels(); setParcel(parcelId); }} /> : null}
        </section>
        <section className="pf-card pf-composer-card"><div className="pf-section-heading"><span>2</span><div><strong>Résultat attendu</strong><small>Ce que Gérard doit réellement livrer</small></div></div><div className="pf-chips">{GOALS.map((goal) => <button key={goal} type="button" className="pf-chip" data-selected={answers.goal === goal} onClick={() => poulpeStore.setAnswer("goal", goal)}>{goal}</button>)}</div><textarea className="pf-textarea" placeholder="Décris directement le résultat attendu…" value={GOALS.includes(answers.goal ?? "") ? "" : answers.goal ?? ""} onChange={(event) => poulpeStore.setAnswer("goal", event.target.value)} /></section>
        <section className="pf-card pf-composer-card"><div className="pf-section-heading"><span>3</span><div><strong>Cadre utile</strong><small>Facultatif — Gérard et Publisher complètent le reste</small></div></div><label className="pf-field-label">Public</label><div className="pf-chips">{AUDIENCES.map((audience) => <button key={audience} type="button" className="pf-chip" data-selected={answers.audience === audience} onClick={() => poulpeStore.setAnswer("audience", audience)}>{audience}</button>)}</div><label className="pf-field-label">Ton</label><div className="pf-chips">{FORMATS.map((format) => <button key={format} type="button" className="pf-chip" data-selected={answers.format === format} onClick={() => poulpeStore.setAnswer("format", format)}>{format}</button>)}</div><textarea className="pf-textarea" placeholder="Contraintes, sources, délai ou détail important…" value={answers.details ?? ""} onChange={(event) => poulpeStore.setAnswer("details", event.target.value)} /></section>
        <section className="pf-card pf-launch-card"><div><div className="pf-q-eyebrow">Mission prête</div><strong>{selectedParcel?.name ?? "Choisis un projet"}</strong><p>{answers.goal || "Décris le résultat attendu pour continuer."}</p></div><button className="pf-btn pf-btn-primary pf-launch" type="button" disabled={!ready} onClick={onSubmit}>Confier à Gérard</button></section>
      </> : null}
    </div>
  );}