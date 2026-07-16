import type { PoulpeRuntimeAdapter } from "./PoulpeRuntimeAdapter";

declare global {
  interface Window {
    __POULPE_RUNTIME_ADAPTER__?: PoulpeRuntimeAdapter;
  }
}

export function createRuntimeAdapter(): PoulpeRuntimeAdapter {
  const adapter = window.__POULPE_RUNTIME_ADAPTER__;
  if (!adapter) {
    throw new Error("L’adaptateur Poulpe → Octopus existant n’est pas encore injecté dans la nouvelle façade.");
  }
  return adapter;
}
