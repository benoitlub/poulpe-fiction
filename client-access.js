(function clientAccessModule(global) {
  "use strict";

  const ACCESS_KEY = "poulpe-fiction:access-context:v1";
  const DEFAULT_OWNER_ID = "benoit-lubert";

  function readStored() {
    try { return JSON.parse(localStorage.getItem(ACCESS_KEY) || "null"); }
    catch (_) { return null; }
  }

  function fromLocation() {
    const params = new URLSearchParams(location.search);
    const requestedMode = params.get("mode");
    const parcelId = params.get("parcel") || params.get("parcelId");
    const clientId = params.get("client") || params.get("clientId");
    const mode = requestedMode === "owner" ? "owner" : parcelId ? "client" : null;
    return mode ? { mode, parcelId: parcelId || null, clientId: clientId || null } : null;
  }

  function normalize(value) {
    const stored = value || {};
    const mode = stored.mode === "client" ? "client" : "owner";
    return {
      version: 1,
      mode,
      ownerId: stored.ownerId || DEFAULT_OWNER_ID,
      clientId: mode === "client" ? stored.clientId || null : null,
      parcelId: mode === "client" ? stored.parcelId || null : null,
      updatedAt: new Date().toISOString()
    };
  }

  let context = normalize(fromLocation() || readStored() || { mode: "owner" });
  localStorage.setItem(ACCESS_KEY, JSON.stringify(context));

  function setContext(next) {
    context = normalize({ ...context, ...next });
    localStorage.setItem(ACCESS_KEY, JSON.stringify(context));
    global.dispatchEvent(new CustomEvent("poulpe-access-changed", { detail: context }));
    global.render?.();
    global.GardenShell?.mount?.();
    return context;
  }

  function snapshot() { return { ...context }; }
  function isOwner() { return context.mode === "owner"; }
  function visibleParcel(parcelId) { return isOwner() || !context.parcelId || context.parcelId === parcelId; }

  function scopedUrl(base, path, extra) {
    const url = new URL(path || "/", base);
    url.searchParams.set("mode", context.mode);
    if (context.parcelId) url.searchParams.set("parcel", context.parcelId);
    if (context.clientId) url.searchParams.set("client", context.clientId);
    Object.entries(extra || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function createClientLink(parcelId, clientId) {
    return scopedUrl(location.origin, location.pathname, { mode: "client", parcel: parcelId, client: clientId });
  }

  global.PoulpeAccess = {
    ACCESS_KEY,
    snapshot,
    setContext,
    isOwner,
    visibleParcel,
    scopedUrl,
    createClientLink
  };
})(globalThis);
