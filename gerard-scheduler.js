(function gerardSchedulerModule(global) {
  "use strict";

  const ACTIVE_WINDOW_MS = 1_200;
  let lastInteractionAt = 0;

  function markInteraction() {
    lastInteractionAt = Date.now();
  }

  function hasActiveUserInteraction() {
    return Date.now() - lastInteractionAt < ACTIVE_WINDOW_MS;
  }

  ["pointerdown", "touchstart", "keydown", "wheel"].forEach((eventName) => {
    global.addEventListener(eventName, markInteraction, { passive: true });
  });

  global.GerardScheduler = {
    hasActiveUserInteraction,
    markInteraction
  };
})(globalThis);
