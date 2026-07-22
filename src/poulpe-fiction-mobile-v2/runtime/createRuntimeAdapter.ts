import type { PoulpeRuntimeAdapter } from "./PoulpeRuntimeAdapter";

declare global {
  interface Window {
    __POULPE_RUNTIME_ADAPTER__?: PoulpeRuntimeAdapter;
  }
}

/**
 * Poulpe Fiction must use the real Octopus runtime injected by the host.
 * There is deliberately no browser/GitHub-Issue fallback here: opening an
 * issue is a legacy transport and must never masquerade as a Gérard mission.
 */
export function createRuntimeAdapter(): PoulpeRuntimeAdapter {
  const adapter = window.__POULPE_RUNTIME_ADAPTER__;
  if (!adapter) {
    throw new Error("Le runtime Octopus réel n’est pas chargé. Aucun ticket GitHub ne sera créé.");
  }
  return adapter;
}
