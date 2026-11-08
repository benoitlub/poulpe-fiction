/** Public operational summary. Tool responses and deliverable bodies stay out. */
const scalars = new Set([
  "status", "httpStatus", "operationId", "missionId", "contextId", "adapterId",
  "executorId", "tentacleId", "resourceId", "seedId", "parcelId", "harvestId",
  "harvestMode", "phase", "decision", "state", "mode", "capability", "slug",
  "source", "route", "reason", "at", "createdAt", "updatedAt", "harvestedAt",
  "retryAt", "completed", "verified", "simulated", "processed", "contentLength",
  "itemCount", "connected", "totalItems", "matchedItems", "discoveredItems",
  "reused", "fileVerified", "missionAccepted", "artifactDeclared", "imageRetrieved", "readyForReview", "readyForDiffusion", "code", "isMock", "mock", "isDemo", "provenance", "producer",
  "digestedItems", "published", "contacted", "verifiedContacts", "researchRequired",
]);
const objects = new Set([
  "knowledge", "octopus", "harvest", "persistedHarvest", "verification", "payload",
  "studio", "report", "evidence", "output", "resourceResult", "diagnostics", "lifecycle", "deferred", "delivery",
]);
const identifier = /^[A-Za-z0-9_.:>\/-]{1,160}$/;

export function summarizeCycleResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const summary = {};
  for (const [key, item] of Object.entries(value)) {
    if (scalars.has(key)) {
      // Free-form error messages, names, URLs, prompts and contact fields are
      // deliberately excluded. Never infer safety from the absence of email.
      if (typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) summary[key] = item;
      else if (typeof item === "string" && identifier.test(item) && !item.includes("://")) summary[key] = item;
    } else if (objects.has(key) && item && typeof item === "object" && !Array.isArray(item)) {
      summary[key] = summarizeCycleResult(item);
    }
  }
  return summary;
}

export function summarizeStateResult(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new TypeError("State must be an object");
  return { ...state, lastResult: summarizeCycleResult(state.lastResult) };
}
