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
  const stepIndex = usePoulpeStore((state) => state.stepIndex);
  const answers = usePoulpeStore((state) => state.answers);
  const progress = usePoulpeStore((state) => state.progress);

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

  const chooseParcel = (parcelId: string) => {
    poulpeStore.setAnswer("parcelId", parcelId);
    try { localStorage.setItem(SELECTED_PARCEL_KEY, parcelId); } catch (_) {}
  };

  const selectedParcel = useMemo(() => parcels.find((parcel) => parcel.id === answers.parcelId), [parcels, answers.parcelId]);
  const runtimeQuestion = progress?.state === "needs-input" ? progress.question : undefined;

  if (runtimeQuestion) {
    const isChoice = runtimeQuestion.inputType === "choice" && runtimeQuestion.options?.length;
    return (
      <QuestionStep eyebrow="Gérard a besoin d’un détail" title={runtimeQuestion.label} hint={runtimeQuestion.reason} canBack={false} canNext={false} onNext={() => undefined}>
        {isChoice ? (
          <div className="pf-chips">
            {runtimeQuestion.options!.map((option) => (
              <button key={option} type="button" className="pf-chip" onClick={async () => {
                const next = await runtime.answerQuestion(runtimeQuestion.missionId, runtimeQuestion.id, option);
                poulpeStore.setProgress(next);
                poulpeStore.setTab("hublot");
              }}>{option}</button>
            ))}
          </div>
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
            <div className="pf-actions" style={{ justifyContent: "flex-end" }}><button className="pf-btn pf-btn-primary" type="submit">Répondre à Gérard</button></div>
          </form>
        )}
      </QuestionStep>
    );
  }

  const parcelSelector = (
    <div>
      {parcels.map((parcel) => <button key={parcel.id} type="button" className="pf-parcel" data-selected={answers.parcelId === parcel.id} onClick={() => chooseParcel(parcel.id)}><span className="pf-emoji">{parcel.emoji ?? "🌱"}</span><span><div className="pf-parcel-name">{parcel.name}</div><div className="pf-parcel-desc">{parcel.description}</div></span></button>)}
      {!parcels.length ? <div className="pf-empty"><p>Aucun projet n’est encore disponible dans le Garden.</p></div> : null}
    </div>
  );

  const steps = [
    {
      title: clientContext ? `Bonjour ${clientContext.displayName}. Pour quel projet cultivons-nous aujourd’hui ?` : "Pour quel projet cultivons-nous aujourd’hui ?",
      hint: clientContext?.activity ?? "Choisis une parcelle du jardin.",
      canNext: Boolean(answers.parcelId),
      content: parcelSelector,
    },
    { title: "Qu’est-ce qu’on cultive ?", hint: "Une seule chose à la fois.", canNext: Boolean(answers.goal?.trim()), content: <><div className="pf-chips">{GOALS.map((goal) => <button key={goal} type="button" className="pf-chip" data-selected={answers.goal === goal} onClick={() => poulpeStore.setAnswer("goal", goal)}>{goal}</button>)}</div><input className="pf-input" placeholder="Ou décris librement…" value={answers.goal ?? ""} onChange={(event) => poulpeStore.setAnswer("goal", event.target.value)} /></> },
    { title: "À qui s’adresse cette récolte ?", hint: "Gérard pourra demander une précision plus tard si elle devient nécessaire.", canNext: true, content: <><div className="pf-chips">{AUDIENCES.map((audience) => <button key={audience} type="button" className="pf-chip" data-selected={answers.audience === audience} onClick={() => poulpeStore.setAnswer("audience", audience)}>{audience}</button>)}</div><input className="pf-input" placeholder="Facultatif" value={answers.audience ?? ""} onChange={(event) => poulpeStore.setAnswer("audience", event.target.value)} /></> },
    { title: "Une préférence de ton pour cette mission ?", hint: "Facultatif : Publisher pourra demander ce détail au moment utile.", canNext: true, content: <div className="pf-chips">{FORMATS.map((format) => <button key={format} type="button" className="pf-chip" data-selected={answers.format === format} onClick={() => poulpeStore.setAnswer("format", format)}>{format}</button>)}</div> },
    { title: "On confie ça à Gérard ?", hint: "Il utilisera le projet choisi et demandera seulement ce qui lui manque.", canNext: true, content: <div className="pf-summary"><p>Projet : <b>{selectedParcel?.name ?? clientContext?.displayName ?? "—"}</b></p><p>Récolte : <b>{answers.goal ?? "—"}</b></p><textarea className="pf-textarea" placeholder="Un détail utile, facultatif…" value={answers.details ?? ""} onChange={(event) => poulpeStore.setAnswer("details", event.target.value)} /></div> },
  ];

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  return <QuestionStep eyebrow={`Étape ${stepIndex + 1} sur ${steps.length}`} title={step.title} hint={step.hint} canBack={stepIndex > 0} canNext={step.canNext} onBack={() => poulpeStore.prevStep()} onNext={() => stepIndex === steps.length - 1 ? onSubmit() : poulpeStore.nextStep()} nextLabel={stepIndex === steps.length - 1 ? "Confier à Gérard" : "Continuer"}>{step.content}</QuestionStep>;
}
