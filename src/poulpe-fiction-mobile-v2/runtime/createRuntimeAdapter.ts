import type { PoulpeRuntimeAdapter } from "./PoulpeRuntimeAdapter";
import { browserPoulpeRuntimeAdapter } from "./browserPoulpeRuntimeAdapter";

declare global {
  interface Window {
    __POULPE_RUNTIME_ADAPTER__?: PoulpeRuntimeAdapter;
  }
}

export function createRuntimeAdapter(): PoulpeRuntimeAdapter {
  return window.__POULPE_RUNTIME_ADAPTER__ ?? browserPoulpeRuntimeAdapter;
}
