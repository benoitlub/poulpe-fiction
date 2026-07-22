import type { PoulpeRuntimeAdapter } from "./PoulpeRuntimeAdapter";
import { htmlHarvestRuntimeAdapter } from "./htmlHarvestRuntimeAdapter";

declare global {
  interface Window {
    __POULPE_RUNTIME_ADAPTER__?: PoulpeRuntimeAdapter;
  }
}

export function createRuntimeAdapter(): PoulpeRuntimeAdapter {
  return window.__POULPE_RUNTIME_ADAPTER__ ?? htmlHarvestRuntimeAdapter;
}
