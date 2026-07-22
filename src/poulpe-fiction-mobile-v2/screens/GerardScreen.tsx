import { useEffect, useMemo } from "react";
import { QuestionStep } from "../components/QuestionStep";
import type { PoulpeRuntimeAdapter } from "../runtime/PoulpeRuntimeAdapter";
import { poulpeStore, usePoulpeStore } from "../store";
import type { Parcel } from "../types";

const GOALS = ["Un visuel Instagram", "Une liste de contacts", "Une landing page", "Un post LinkedIn"];
const AUDIENCES = ["Notre communauté", "Nouveaux prospects", "Partenaires", "Presse"];
const FORMATS = ["Court et impactant", "Chaleureux et long", "Structuré et professionnel"];
const SELECTED_PARCEL_KEY = "poulpe-fiction:mobile-v2:selected-parcel:v1";

type UnknownRecord = Record<string, unknown>;

declare global {
  interface Window {
    PoulpeAccess?: { snapshot(): UnknownRecord };
    GardenStore?: { snapshot(): { parcels?: UnknownRecord[] } };
  }
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

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

export function GerardScreen({ runtime, onSubmit }: { runtime: PoulpeRuntimeAdapter; onSubmit: () => void }) {
  const clientContext = usePoulpeStore((state) => state.clientContext);
  const parcels = usePoulpeStore((state) => state.parcels);
  const answers = usePoulpeStore((state) => state.answers);
  const missionId = usePoulpeStore((state) => state.missionId);
  const progress = usePoulpeStore((state) => state.progress);
  const harvest = usePoulpeStore((state) => state.harvest);

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
    return () => { alive = false; };
  }, [runtime]);

  const selectedParcel = useMemo(() => parcels.find((parcel) => parcel.id === answers.parcelId), [parcels, answers.parcelId]);
  const runtimeQuestion = progress?.state === "needs-input" ? progress.question : undefined;
  const ready = Boolean(answers.parcelId && answers.goal?.trim());
  const activeMission = Boolean(missionId && progress && !progress.finished);

  const setParcel = (parcelId: string) => {
    poulpeStore.setAnswer("parcelId", parcelId);
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
            if (!answer) return;
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

  return (
    <div className="pf-cockpit">
      <section className="pf-card pf-cockpit-hero">
        <div className="pf-q-eyebrow">Cockpit Gérard</div>
        <h2 className="pf-q-title">Que faut-il faire avancer maintenant ?</h2>
        <p className="pf-q-hint">Une seule vue : le projet, le résultat attendu et les contraintes utiles.</p>
        {clientContext ? <div className="pf-client-card"><strong>{clientContext.displayName}</strong><span>{clientContext.activity}</span></div> : null}
      </section>

      {(activeMission || harvest) ? <section className="pf-card pf-now-card">
        <div className="pf-section-heading"><span>●</span><div><strong>État réel</strong><small>Ce que Gérard a actuellement en main</small></div></div>
        {activeMission && progress ? <div className="pf-now-row"><div><b>{progress.label}</b><small>{progress.description || `Mission en cours — ${Math.round(progress.progress)} %`}</small></div><button type="button" className="pf-btn pf-btn-soft" onClick={() => poulpeStore.setTab("hublot")}>Voir le travail</button></div> : null}
        {harvest ? <div className="pf-now-row"><div><b>{harvest.harvest.title}</b><small>Dernière récolte disponible</small></div><button type="button" className="pf-btn pf-btn-soft" onClick={() => poulpeStore.setTab("harvest")}>Ouvrir</button></div> : null}
      </section> : null}

      <section className="pf-card">
        <div className="pf-section-heading"><span>1</span><div><strong>Projet</strong><small>La parcelle concernée</small></div></div>
        <div className="pf-project-grid">
          {parcels.map((parcel) => (
            <button key={parcel.id} type="button" className="pf-project-choice" data-selected={answers.parcelId === parcel.id} onClick={() => setParcel(parcel.id)}>
              <span className="pf-emoji">{parcel.emoji ?? "🌱"}</span><span><b>{parcel.name}</b><small>{parcel.description}</small></span>
            </button>
          ))}
        </div>
        {!parcels.length ? <div className="pf-empty"><p>Aucun projet disponible dans le Garden.</p></div> : null}
      </section>

      <section className="pf-card">
        <div className="pf-section-heading"><span>2</span><div><strong>Résultat attendu</strong><small>Ce que Gérard doit réellement livrer</small></div></div>
        <div className="pf-chips">{GOALS.map((goal) => <button key={goal} type="button" className="pf-chip" data-selected={answers.goal === goal} onClick={() => poulpeStore.setAnswer("goal", goal)}>{goal}</button>)}</div>
        <textarea className="pf-textarea" placeholder="Décris directement le résultat attendu…" value={GOALS.includes(answers.goal ?? "") ? "" : answers.goal ?? ""} onChange={(event) => poulpeStore.setAnswer("goal", event.target.value)} />
      </section>

      <section className="pf-card">
        <div className="pf-section-heading"><span>3</span><div><strong>Cadre utile</strong><small>Facultatif — Gérard et Publisher complètent le reste</small></div></div>
        <label className="pf-field-label">Public</label>
        <div className="pf-chips">{AUDIENCES.map((audience) => <button key={audience} type="button" className="pf-chip" data-selected={answers.audience === audience} onClick={() => poulpeStore.setAnswer("audience", audience)}>{audience}</button>)}</div>
        <label className="pf-field-label">Ton</label>
        <div className="pf-chips">{FORMATS.map((format) => <button key={format} type="button" className="pf-chip" data-selected={answers.format === format} onClick={() => poulpeStore.setAnswer("format", format)}>{format}</button>)}</div>
        <textarea className="pf-textarea" placeholder="Contraintes, sources, délai ou détail important…" value={answers.details ?? ""} onChange={(event) => poulpeStore.setAnswer("details", event.target.value)} />
      </section>

      <section className="pf-card pf-launch-card">
        <div><div className="pf-q-eyebrow">Mission prête</div><strong>{selectedParcel?.name ?? "Choisis un projet"}</strong><p>{answers.goal || "Décris le résultat attendu pour continuer."}</p></div>
        <button className="pf-btn pf-btn-primary pf-launch" type="button" disabled={!ready} onClick={onSubmit}>Confier à Gérard</button>
      </section>
    </div>
  );
}
