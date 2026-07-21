import { useEffect, useMemo, useRef, useState } from "react";
import "./styles/poulpe-fiction-mobile-v2.css";
import { BottomNav } from "./components/BottomNav";
import { GerardScreen } from "./screens/GerardScreen";
import { HublotScreen } from "./screens/HublotScreen";
import { HarvestScreen } from "./screens/HarvestScreen";
import { poulpeStore, usePoulpeStore } from "./store";
import { createRuntimeAdapter } from "./runtime/createRuntimeAdapter";
import { restoreLatestGardenHarvest } from "./runtime/restoreGardenHarvest";
import type { PoulpeRuntimeAdapter } from "./runtime/PoulpeRuntimeAdapter";

export function PoulpeFictionApp({ adapter }: { adapter?: PoulpeRuntimeAdapter }) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const runtime = useMemo(() => {
    try { return adapter ?? createRuntimeAdapter(); }
    catch (error) { setRuntimeError(error instanceof Error ? error.message : "Adaptateur indisponible"); return null; }
  }, [adapter]);
  const tab = usePoulpeStore((state) => state.tab);
  const missionId = usePoulpeStore((state) => state.missionId);
  const progress = usePoulpeStore((state) => state.progress);
  const harvest = usePoulpeStore((state) => state.harvest);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    const restore = () => {
      const restored = restoreLatestGardenHarvest();
      if (!restored) return;
      poulpeStore.set({
        missionId: restored.bundle.missionId,
        progress: restored.progress,
        harvest: restored.bundle,
        tab: "harvest",
      });
    };

    restore();
    window.addEventListener("poulpe-github-harvest", restore);
    window.addEventListener("poulpe-garden-changed", restore);
    return () => {
      window.removeEventListener("poulpe-github-harvest", restore);
      window.removeEventListener("poulpe-garden-changed", restore);
    };
  }, []);

  useEffect(() => {
    if (!runtime || !missionId || progress?.state === "needs-input" || progress?.finished) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await runtime.getMissionProgress(missionId);
        if (cancelled) return;
        poulpeStore.setProgress(next);
        if (next.state === "needs-input") { poulpeStore.setTab("gerard"); return; }
        if (next.finished) {
          const bundle = await runtime.getLatestHarvest(missionId);
          if (!cancelled && bundle) poulpeStore.setHarvest(bundle);
        }
      } catch (error) {
        if (!cancelled) setRuntimeError(error instanceof Error ? error.message : "Le suivi de mission a échoué.");
      }
    };
    void tick();
    pollingRef.current = window.setInterval(tick, 1200);
    return () => { cancelled = true; if (pollingRef.current) window.clearInterval(pollingRef.current); pollingRef.current = null; };
  }, [missionId, progress?.state, progress?.finished, runtime]);

  if (!runtime) {
    return <div className="pf-root"><div className="pf-shell"><main className="pf-screen"><section className="pf-card pf-empty"><h2>La nouvelle façade est prête</h2><p>{runtimeError}</p><p>Il reste à lui injecter l’adaptateur Octopus déjà présent dans Poulpe-Fiction.</p></section></main></div></div>;
  }

  const handleSubmit = async () => {
    const intent = poulpeStore.buildIntent();
    if (!intent) return;
    try {
      const result = await runtime.startCultivation(intent);
      poulpeStore.setMission(result.missionId);
      poulpeStore.setTab("hublot");
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Impossible de confier la mission à Gérard.");
    }
  };

  return (
    <div className="pf-root"><div className="pf-shell">
      <header className="pf-topbar"><div className="pf-topbar-mark" aria-hidden>🐙</div><div><h1>Poulpe-Fiction</h1><div className="pf-sub">Gérard cultive vos idées</div></div></header>
      {runtimeError ? <div className="pf-runtime-note">{runtimeError}</div> : null}
      <main className="pf-screen" role="main">
        {tab === "gerard" ? <GerardScreen runtime={runtime} onSubmit={handleSubmit} /> : null}
        {tab === "hublot" ? <HublotScreen progress={progress} runtime={runtime} onGoToHarvest={() => poulpeStore.setTab("harvest")} onBackToGerard={() => poulpeStore.setTab("gerard")} onNeedsInput={() => poulpeStore.setTab("gerard")} /> : null}
        {tab === "harvest" ? <HarvestScreen bundle={harvest} onBackToGerard={() => { poulpeStore.resetMission(); poulpeStore.setTab("gerard"); }} /> : null}
      </main>
      <BottomNav active={tab} onChange={(next) => poulpeStore.setTab(next)} harvestReady={Boolean(harvest)} hublotActive={Boolean(missionId) && !harvest} />
    </div></div>
  );
}
