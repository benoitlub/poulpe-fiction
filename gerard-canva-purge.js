(function gerardCanvaPurgeModule(global) {
  "use strict";

  // One-time cleanup, requested by the user, for pre-fix Canva links
  // (canva.com/design/log_.../edit — Composio's own execution-trace id,
  // never a real design; see blacklace-publisher-ai commit 859d2ac2).
  // Neon's own copy was purged separately; this cleans what individual
  // browsers already imported before that fix existed. Runs once per
  // browser (flagged in localStorage), safe to no-op forever after.
  const DONE_KEY = "poulpe-fiction:gerard-canva-purge:v1:done";
  const GARDEN_KEY = "poulpe-fiction:garden-domain:v1";
  const BROKEN_URL = /\/design\/log_/i;

  function stripBrokenVisualSection(content) {
    if (typeof content !== "string" || !content) return "";
    let cleaned = content.replace(/\n*##\s*Visuel créé par Gérard[\s\S]*$/i, "").trim();
    cleaned = cleaned.replace(/^Un visuel a été créé par Gérard, sans texte cette fois\s*:\s*\S+\.?$/i, "").trim();
    return cleaned;
  }

  function run() {
    if (global.localStorage.getItem(DONE_KEY)) return;

    let garden;
    try { garden = JSON.parse(global.localStorage.getItem(GARDEN_KEY) || "{}"); }
    catch (_) { garden = {}; }

    const harvests = Array.isArray(garden.harvests) ? garden.harvests : [];
    if (!harvests.length) { global.localStorage.setItem(DONE_KEY, new Date().toISOString()); return; }

    let removed = 0;
    let cleaned = 0;
    const kept = [];

    for (const harvest of harvests) {
      const urlBroken = BROKEN_URL.test(harvest?.url || "");
      const contentBroken = BROKEN_URL.test(harvest?.content || "");
      if (!urlBroken && !contentBroken) { kept.push(harvest); continue; }

      const strippedContent = stripBrokenVisualSection(harvest.content || "");
      if (!strippedContent) {
        removed++;
        continue;
      }
      const next = { ...harvest, content: strippedContent };
      if (urlBroken) delete next.url;
      kept.push(next);
      cleaned++;
    }

    if (!removed && !cleaned) { global.localStorage.setItem(DONE_KEY, new Date().toISOString()); return; }

    garden.harvests = kept;
    garden.updatedAt = new Date().toISOString();
    global.localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));
    global.localStorage.setItem(DONE_KEY, new Date().toISOString());

    try { global.dispatchEvent(new CustomEvent("poulpe-garden-changed", { detail: garden })); } catch (_) {}
    try {
      global.pushChat?.("gerard", `🧹 J'ai retiré ${removed} récolte${removed > 1 ? "s" : ""} qui ne contenaient qu'un lien Canva cassé, et nettoyé ${cleaned} autre${cleaned > 1 ? "s" : ""} qui en avaient un en plus d'un vrai texte.`);
    } catch (_) {}
  }

  try { run(); } catch (_) { /* never block the app on a cleanup pass */ }

  global.GerardCanvaPurge = { run };
})(globalThis);
