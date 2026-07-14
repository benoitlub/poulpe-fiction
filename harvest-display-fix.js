(function harvestDisplayFix(global) {
  "use strict";

  const MAX_EXCERPT_LENGTH = 360;

  function readableText(raw) {
    const normalized = String(raw || "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, " ");

    try {
      const documentValue = new DOMParser().parseFromString(normalized, "text/html");
      const text = documentValue.body?.textContent || normalized;
      return text.replace(/\s+/g, " ").trim();
    } catch (_) {
      return normalized.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  function excerpt(value) {
    const text = readableText(value);
    if (text.length <= MAX_EXCERPT_LENGTH) return text;
    return `${text.slice(0, MAX_EXCERPT_LENGTH).trimEnd()}…`;
  }

  function sanitizeHarvestCards() {
    document.querySelectorAll(".harvest-card .harvest-content:not([data-harvest-sanitized])")
      .forEach((content) => {
        const summary = excerpt(content.textContent);
        const replacement = document.createElement("p");
        replacement.className = "harvest-excerpt";
        replacement.dataset.harvestSanitized = "true";
        replacement.textContent = summary || "Contenu disponible avec le bouton Ouvrir.";
        content.replaceWith(replacement);
      });
  }

  const baseRender = global.render;
  if (typeof baseRender === "function") {
    global.render = function renderWithReadableHarvests() {
      baseRender();
      sanitizeHarvestCards();
    };
  }

  global.HarvestDisplayFix = { readableText, excerpt, sanitizeHarvestCards };

  if (typeof queueMicrotask === "function") queueMicrotask(sanitizeHarvestCards);
  else setTimeout(sanitizeHarvestCards, 0);
})(globalThis);
