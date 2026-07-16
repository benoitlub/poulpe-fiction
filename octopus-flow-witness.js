(function octopusFlowWitnessModule(global) {
  "use strict";

  const STORAGE_KEY = "poulpe-fiction:octopus-flow-trace:v1";
  const octopusBase = String(global.PoulpeRuntimeConfig?.urls?.octopusApi || global.OCTOPUS_API || "").replace(/\/$/, "");
  const publisherBase = String(global.PoulpeRuntimeConfig?.urls?.publisherApi || global.PUBLISHER_API || "").replace(/\/$/, "");
  let connection = { connected: false, latencyMs: null, checkedAt: null, error: null };
  let publisherTrace = null;
  let expanded = false;

  function now() { return new Date().toISOString(); }
  function readTrace() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { return null; } }
  function writeTrace(patch) {
    const trace = Object.assign({ version: 1, timeline: [] }, readTrace() || {}, patch, { updatedAt: now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trace));
    render();
    return trace;
  }
  function addEvent(stage, status, detail, missionId) {
    const previous = readTrace() || { version: 1, timeline: [] };
    const event = { at: now(), stage, status, detail: String(detail || ""), missionId: missionId || previous.missionId || null };
    return writeTrace({
      missionId: event.missionId,
      status,
      timeline: [event, ...(previous.timeline || [])].slice(0, 12),
    });
  }
  function short(value) {
    const text = String(value || "—");
    return text.length > 30 ? `${text.slice(0, 13)}…${text.slice(-10)}` : text;
  }
  function clock(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  async function jsonFetch(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const startedAt = Date.now();
      const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal });
      const text = await response.text();
      let payload = {};
      try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { error: text }; }
      return { ok: response.ok, payload, latencyMs: Date.now() - startedAt };
    } finally { global.clearTimeout(timer); }
  }

  async function refreshConnections() {
    try {
      const [octopus, publisher] = await Promise.all([
        octopusBase ? jsonFetch(`${octopusBase}/health`) : Promise.resolve({ ok: false, payload: {}, latencyMs: null }),
        publisherBase ? jsonFetch(`${publisherBase}/api/octopus-adapter/trace`) : Promise.resolve({ ok: false, payload: {}, latencyMs: null }),
      ]);
      connection = { connected: octopus.ok, latencyMs: octopus.latencyMs, checkedAt: now(), error: octopus.ok ? null : (octopus.payload?.error || "Octopus indisponible") };
      publisherTrace = publisher.ok ? publisher.payload?.trace || null : null;
    } catch (error) {
      connection = { connected: false, latencyMs: null, checkedAt: now(), error: error instanceof Error ? error.message : "Diagnostic indisponible" };
    }
    render();
  }

  function ensurePanel() {
    let panel = document.getElementById("octopusFlowWitness");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "octopusFlowWitness";
    panel.style.cssText = "margin:12px 0;border:1px solid rgba(140,100,255,.35);border-radius:14px;background:rgba(15,10,35,.72);color:inherit;overflow:hidden;font:12px/1.4 system-ui";
    const root = document.getElementById("root");
    (root || document.body).prepend(panel);
    panel.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-octopus-witness-toggle]")) { expanded = !expanded; render(); }
    });
    return panel;
  }

  function render() {
    if (!document.body) return;
    const panel = ensurePanel();
    const trace = readTrace() || { timeline: [] };
    const missionId = trace.missionId || publisherTrace?.missionId || publisherTrace?.operationId || null;
    const sameMission = missionId && [publisherTrace?.missionId, publisherTrace?.operationId].filter(Boolean).includes(missionId);
    const publisherState = sameMission ? publisherTrace?.status : (publisherTrace?.status === "idle" ? "idle" : "autre mission");
    const dot = connection.connected ? "#34d399" : "#f87171";
    const missionDot = trace.status === "ready" ? "#34d399" : trace.status === "failed" ? "#f87171" : trace.status ? "#fbbf24" : "#777";
    const events = (trace.timeline || []).map((item) => `<li style="margin:4px 0"><span style="opacity:.65">${esc(clock(item.at))}</span> · <strong>${esc(item.stage)}</strong> · ${esc(item.status)}${item.detail ? ` — ${esc(item.detail)}` : ""}</li>`).join("");
    panel.innerHTML = `
      <button data-octopus-witness-toggle type="button" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:0;background:transparent;color:inherit;text-align:left">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};margin-right:8px"></span>🐙 Liaison Octopus</span>
        <span style="opacity:.7">${connection.connected ? `${connection.latencyMs} ms` : "hors ligne"} · ${expanded ? "▲" : "▼"}</span>
      </button>
      ${expanded ? `<div style="border-top:1px solid rgba(140,100,255,.25);padding:10px 12px">
        <p style="margin:0 0 6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${missionDot};margin-right:8px"></span><strong>Mission ${esc(short(missionId))}</strong></p>
        <p style="margin:3px 0">Poulpe → Octopus : ${esc(trace.status || "aucune mission")}</p>
        <p style="margin:3px 0">Octopus → Publisher : ${esc(publisherState || "aucune réception")}</p>
        <p style="margin:3px 0">Capacité Publisher : ${esc(publisherTrace?.capability || "—")}</p>
        <p style="margin:3px 0">Producteur : ${esc(publisherTrace?.producer || "—")}</p>
        <p style="margin:3px 0">Artefacts : ${esc(publisherTrace?.artifactCount ?? 0)}</p>
        ${publisherTrace?.error ? `<p style="margin:5px 0;color:#f87171">Erreur Publisher : ${esc(publisherTrace.error)}</p>` : ""}
        <ol style="margin:8px 0 0;padding-left:18px">${events || "<li>Aucune mission tracée.</li>"}</ol>
      </div>` : ""}`;
  }

  function installAdapterTrace() {
    const adapter = global.PoulpeOctopusAdapter;
    if (!adapter || adapter.__flowWitnessInstalled) return false;
    const baseDispatch = adapter.dispatch.bind(adapter);
    adapter.dispatch = async function tracedDispatch(payload, options) {
      const missionId = payload?.operationId || payload?.missionId || payload?.id || `mission_${Date.now()}`;
      const startedAt = Date.now();
      addEvent("Poulpe → Octopus", "queued", payload?.title || payload?.objective || "Mission envoyée", missionId);
      try {
        const value = await baseDispatch(payload, options);
        const status = value?.result?.status || "received";
        addEvent("Octopus → Poulpe", status, value?.result?.summary || "Réponse reçue", missionId);
        writeTrace({ durationMs: Date.now() - startedAt, result: value?.result || null });
        global.setTimeout(() => void refreshConnections(), 500);
        return value;
      } catch (error) {
        addEvent("Octopus → Poulpe", "failed", error instanceof Error ? error.message : "Échec", missionId);
        writeTrace({ durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    };
    adapter.executeProduction = async function tracedProduction(input) {
      const payload = adapter.productionPayload(input);
      const dispatched = await adapter.dispatch(payload, { kind: "production" });
      return { ...dispatched, payload };
    };
    adapter.__flowWitnessInstalled = true;
    return true;
  }

  function start() {
    installAdapterTrace();
    global.setTimeout(installAdapterTrace, 0);
    global.setTimeout(installAdapterTrace, 1000);
    void refreshConnections();
    global.setInterval(() => void refreshConnections(), 15_000);
    global.addEventListener("poulpe-octopus-result", () => void refreshConnections());
    global.addEventListener("poulpe-octopus-error", () => void refreshConnections());
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  global.OctopusFlowWitness = { refresh: refreshConnections, trace: readTrace, addEvent };
})(globalThis);
