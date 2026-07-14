(function bootDiagnosticsModule(global) {
  "use strict";

  const startedAt = Date.now();
  const requests = new Map();
  const errors = [];
  const nativeFetch = global.fetch?.bind(global);
  let sequence = 0;
  let loadFired = false;
  let domReady = false;

  function shortUrl(value) {
    try {
      const url = new URL(String(value), location.href);
      return `${url.host}${url.pathname}${url.search}`;
    } catch (_) {
      return String(value || "requête inconnue");
    }
  }

  function ensurePanel() {
    let panel = document.getElementById("bootDiagnosticsPanel");
    if (panel) return panel;
    panel = document.createElement("details");
    panel.id = "bootDiagnosticsPanel";
    panel.open = true;
    panel.style.cssText = "position:relative;z-index:9999;margin:12px 0;padding:12px;border:1px solid rgba(255,180,90,.65);border-radius:12px;background:rgba(35,20,8,.94);color:#fff;font:13px/1.4 system-ui";
    panel.innerHTML = '<summary style="font-weight:700;cursor:pointer">🔎 Diagnostic de démarrage</summary><div id="bootDiagnosticsBody" style="margin-top:8px"></div>';
    const root = document.getElementById("root");
    (root || document.body).prepend(panel);
    return panel;
  }

  function snapshot() {
    const now = Date.now();
    const active = [...requests.values()].filter((item) => !item.endedAt);
    const slow = active.filter((item) => now - item.startedAt > 3000);
    return { active, slow, errors: errors.slice(-5), elapsed: now - startedAt, loadFired, domReady };
  }

  function render() {
    if (!document.body) return;
    const panel = ensurePanel();
    const body = panel.querySelector("#bootDiagnosticsBody");
    const data = snapshot();
    const status = data.errors.length
      ? "Erreur JavaScript détectée"
      : data.slow.length
        ? "Une requête bloque encore"
        : data.loadFired
          ? "Document chargé"
          : "Démarrage en cours";
    const activeHtml = data.active.length
      ? `<p><strong>Requêtes ouvertes (${data.active.length})</strong></p><ul>${data.active.map((item) => `<li>${Math.round((Date.now() - item.startedAt) / 100) / 10}s · ${item.method} · ${shortUrl(item.url)}</li>`).join("")}</ul>`
      : "<p>Aucune requête fetch ouverte.</p>";
    const errorHtml = data.errors.length
      ? `<p><strong>Erreurs</strong></p><ul>${data.errors.map((item) => `<li>${String(item.message || item)}</li>`).join("")}</ul>`
      : "";
    body.innerHTML = `<p><strong>${status}</strong> · ${Math.round(data.elapsed / 100) / 10}s</p><p>DOMContentLoaded: ${data.domReady ? "oui" : "non"} · window.load: ${data.loadFired ? "oui" : "non"}</p>${activeHtml}${errorHtml}`;
    panel.style.display = data.slow.length || data.errors.length || !data.loadFired ? "block" : "none";
  }

  if (nativeFetch) {
    global.fetch = async function diagnosticFetch(input, init = {}) {
      const id = ++sequence;
      const item = {
        id,
        url: typeof input === "string" ? input : input?.url,
        method: String(init?.method || "GET").toUpperCase(),
        startedAt: Date.now(),
        endedAt: null,
      };
      requests.set(id, item);
      render();
      try {
        return await nativeFetch(input, init);
      } catch (error) {
        errors.push({ message: `${item.method} ${shortUrl(item.url)} · ${error?.message || error}` });
        throw error;
      } finally {
        item.endedAt = Date.now();
        render();
      }
    };
  }

  global.addEventListener("error", (event) => {
    errors.push({ message: `${event.message || "Erreur"}${event.filename ? ` · ${shortUrl(event.filename)}:${event.lineno || 0}` : ""}` });
    render();
  });

  global.addEventListener("unhandledrejection", (event) => {
    errors.push({ message: `Promesse rejetée · ${event.reason?.message || event.reason || "raison inconnue"}` });
    render();
  });

  document.addEventListener("DOMContentLoaded", () => {
    domReady = true;
    render();
  }, { once: true });

  global.addEventListener("load", () => {
    loadFired = true;
    render();
  }, { once: true });

  global.setInterval(render, 1000);
  global.PoulpeBootDiagnostics = { snapshot, requests, errors };
})(globalThis);
