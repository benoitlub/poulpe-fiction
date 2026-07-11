(function landingPreviewFix(global) {
  "use strict";

  function activePack() {
    const context = global.BlacklaceParcel?.activeSeed?.();
    const packs = global.ProductionPack?.load?.() || [];
    return context ? packs.find((pack) => pack.seedId === context.seedId) || packs[0] : packs[0];
  }

  function openHtmlPreview(content) {
    const blob = new Blob([String(content || "")], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const preview = global.open(url, "_blank");
    if (!preview) {
      URL.revokeObjectURL(url);
      return false;
    }
    global.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-production-preview]");
    if (!button) return;

    const pack = activePack();
    const artifact = pack?.artifacts?.find((item) => item.id === button.dataset.productionPreview);
    if (!artifact?.content) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openHtmlPreview(artifact.content);
  }, true);
})(globalThis);
