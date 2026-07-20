(function loadStableGerardKnowledgeGarden(global) {
  "use strict";
  if (global.GerardKnowledgeGarden) return;
  const script = document.createElement("script");
  script.src = "./gerard-knowledge-garden-v3.js?v=20260720-local-first";
  script.async = false;
  document.head.appendChild(script);
})(globalThis);
