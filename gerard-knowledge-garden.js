(function loadStableGerardKnowledgeGarden(global) {
  "use strict";
  if (global.GerardKnowledgeGarden) return;
  const script = document.createElement("script");
  script.src = "./gerard-knowledge-garden-v2.js?v=20260718-stable";
  script.async = false;
  document.head.appendChild(script);
})(globalThis);
