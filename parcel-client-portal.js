(function parcelClientPortalModule(global) {
  "use strict";

  const API_BASE = global.PUBLISHER_API_URL || localStorage.getItem("PUBLISHER_API_URL") || "https://blacklace-publisher-api.onrender.com";
  const TOKEN_KEY = "poulpe-fiction:parcel-share-tokens:v1";

  function slug(value) {
    return String(value || "parcelle")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "parcelle";
  }

  function randomToken() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function readTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function writeTokens(tokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }

  function parcelSnapshot(parcelId) {
    const garden = global.GardenStore?.snapshot?.() || {};
    const parcel = (garden.parcels || []).find((item) => item.id === parcelId);
    if (!parcel) return null;
    return {
      version: 1,
      parcel,
      seeds: (garden.seeds || []).filter((item) => item.parcelId === parcelId),
      operations: (garden.operations || []).filter((item) => item.parcelId === parcelId),
      harvests: (garden.harvests || []).filter((item) => item.parcelId === parcelId),
      updatedAt: new Date().toISOString()
    };
  }

  async function publish(parcelId) {
    const snapshot = parcelSnapshot(parcelId);
    if (!snapshot) throw new Error("Parcelle introuvable.");
    const tokens = readTokens();
    const token = tokens[parcelId] || randomToken();
    tokens[parcelId] = token;
    writeTokens(tokens);

    const response = await fetch(`${API_BASE}/api/global-state/client-parcels/${encodeURIComponent(token)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(snapshot)
    });
    if (!response.ok) throw new Error(`Publisher refuse la synchronisation (${response.status}).`);
    return createClientLink(parcelId, token);
  }

  function createClientLink(parcelId, token) {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set("mode", "client");
    url.searchParams.set("parcel", parcelId);
    url.searchParams.set("access", token);
    return url.toString();
  }

  async function loadClientParcel() {
    const access = new URLSearchParams(location.search).get("access");
    if (!access) return false;
    const response = await fetch(`${API_BASE}/api/global-state/client-parcels/${encodeURIComponent(access)}`);
    if (!response.ok) throw new Error("Cette parcelle n’est pas disponible.");
    const record = await response.json();
    const payload = record.value || record.payload || record.data || record;
    if (!payload?.parcel) throw new Error("La parcelle partagée est incomplète.");

    global.GardenStore?.registerParcel?.(payload.parcel);
    (payload.seeds || []).forEach((item) => global.GardenStore?.plantSeed?.(item));
    (payload.operations || []).forEach((item) => global.GardenStore?.upsertOperation?.(item));
    (payload.harvests || []).forEach((item) => global.GardenStore?.addHarvest?.(item));
    global.PoulpeAccess?.setContext?.({ mode: "client", parcelId: payload.parcel.id, clientId: access });
    return true;
  }

  async function createParcel(input) {
    const id = `${slug(input.name)}-${Date.now().toString(36)}`;
    const parcel = global.GardenStore?.registerParcel?.({
      id,
      code: input.code || slug(input.name).slice(0, 12).toUpperCase(),
      name: input.name,
      mission: input.mission,
      priorities: input.priorities || ["prospection"],
      client: {
        name: input.clientName || input.name,
        activity: input.activity || "",
        email: input.email || "",
        phone: input.phone || ""
      }
    });
    global.GardenStore?.plantSeed?.({
      id: `${id}:first-seed`,
      parcelId: id,
      title: input.firstSeed || "Comprendre les besoins du client",
      objective: input.mission,
      content: input.mission,
      kind: "client-mission",
      source: "poulpe-fiction:onboarding",
      status: "planted"
    });
    const link = await publish(id);
    return { parcel, link };
  }

  let syncTimer = null;
  function scheduleSync() {
    if (!global.PoulpeAccess?.isOwner?.()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      const tokens = readTokens();
      for (const parcelId of Object.keys(tokens)) {
        try { await publish(parcelId); } catch (_) {}
      }
    }, 800);
  }

  global.addEventListener("storage", scheduleSync);
  global.addEventListener("poulpe-garden-changed", scheduleSync);

  global.ParcelClientPortal = { createParcel, publish, loadClientParcel, createClientLink, scheduleSync };

  if (new URLSearchParams(location.search).get("mode") === "client") {
    loadClientParcel().catch((error) => {
      global.dispatchEvent(new CustomEvent("poulpe-client-parcel-error", { detail: { message: error.message } }));
    });
  }
})(globalThis);
