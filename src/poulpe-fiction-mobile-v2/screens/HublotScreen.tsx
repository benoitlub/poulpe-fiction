import { useEffect, useState } from "react";
import { ActiveExplorations } from "../components/ActiveExplorations";
import { OctopusGarden } from "../components/OctopusGarden";
import { restoreAllGardenHarvests } from "../runtime/restoreGardenHarvest";
import type { PoulpeRuntimeAdapter } from "../runtime/PoulpeRuntimeAdapter";
import type { HarvestBundle, MissionProgress } from "../types";

interface Props {
  progress: MissionProgress | null;
  runtime: PoulpeRuntimeAdapter;
  onGoToHarvest: () => void;
  onBackToGerard: () => void;
  onNeedsInput: () => void;
}

export function HublotScreen({ progress, runtime, onGoToHarvest, onBackToGerard, onNeedsInput }: Props) {
  const [harvests, setHarvests] = useState<HarvestBundle[]>(() => restoreAllGardenHarvests());

  useEffect(() => {
    const refresh = () => setHarvests(restoreAllGardenHarvests());
    refresh();
    window.addEventListener("poulpe-github-harvest", refresh);
    window.addEventListener("poulpe-garden-changed", refresh);
    return () => {
      window.removeEventListener("poulpe-github-harvest", refresh);
      window.removeEventListener("poulpe-garden-changed", refresh);
    };
  }, []);

  const scene = <OctopusGarden step={progress?.step ?? "idle"} harvests={harvests} onSelectHarvest={onGoToHarvest} />;

  if (!progress) {
    return (
      <section className="pf-hublot" aria-label="Hublot sur le jardin">
        {scene}
        <ActiveExplorations />
        <div className="pf-card pf-full-width">
          <div className="pf-empty">
            {harvests.length ? (
              <>
                <h2>Le jardin veille</h2>
                <p>{harvests.length} récolte{harvests.length > 1 ? "s" : ""} déjà cultivée{harvests.length > 1 ? "s" : ""}, visible{harvests.length > 1 ? "s" : ""} ci-dessus. Confie une nouvelle intention à Gérard pour continuer à cultiver.</p>
                <div className="pf-actions-row pf-actions-center">
                  <button className="pf-btn pf-btn-soft" onClick={onGoToHarvest}>Voir les récoltes</button>
                  <button className="pf-btn pf-btn-primary" onClick={onBackToGerard}>Parler à Gérard</button>
                </div>
              </>
            ) : (
              <>
                <h2>Le jardin est calme</h2>
                <p>Confie une intention à Gérard pour commencer.</p>
                <button className="pf-btn pf-btn-primary" onClick={onBackToGerard}>Parler à Gérard</button>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pf-hublot" aria-label="Hublot sur le jardin">
      {scene}
      <ActiveExplorations />
      <div className="pf-card pf-full-width">
        {progress.state === "needs-input" && progress.question ? (
          <div className="pf-blocked"><h3>Gérard a besoin d’un détail</h3><p>{progress.question.label}</p><button className="pf-btn pf-btn-primary" onClick={onNeedsInput}>Répondre</button></div>
        ) : progress.blocked ? (
          <div className="pf-blocked"><h3>{progress.blocked.reason}</h3>{progress.blocked.action ? <button className="pf-btn pf-btn-primary" onClick={() => runtime.requestAuthorization(progress.blocked!.action!.kind)}>{progress.blocked.action.label}</button> : null}</div>
        ) : (
          <>
            <h2 className="pf-step-label">{progress.label}</h2>
            {progress.description ? <p className="pf-step-desc">{progress.description}</p> : null}
            <div className="pf-progress"><div style={{ width: `${Math.round(progress.progress * 100)}%` }} /></div>
            {progress.finished ? <div className="pf-actions pf-actions-center"><button className="pf-btn pf-btn-primary" onClick={onGoToHarvest}>Voir la récolte</button></div> : null}
          </>
        )}
      </div>
    </section>
  );
}
