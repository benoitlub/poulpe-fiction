(function yaelParcelModule(global) {
  "use strict";

  const SEED_ID = "yael-prospection";
  const PARCEL_ID = "project-yael-prospection";
  const seed = {
    id: SEED_ID,
    parcelId: PARCEL_ID,
    type: "service",
    title: "Yael · Préqualification de prospects",
    objective: "Préparer pour Yael un dispositif directement exploitable de préqualification commerciale : critères, score, informations à vérifier, messages de premier contact et tableau de suivi, sans contacter personne automatiquement.",
    firstHarvest: "Un kit textuel complet comprenant une grille de qualification, un score sur 100, une fiche prospect réutilisable, des requêtes de recherche, 3 messages de prise de contact et un tableau de suivi prêt à copier dans un tableur.",
    priority: 0,
    status: "growing",
    maturity: 82,
    knowledgeTouches: 3,
    textOnly: true,
    forbiddenProviders: ["canva"],
    externalAction: "requires-human-approval",
    plantedBy: "gerard",
    gardener: "gerard",
    plantedAt: new Date().toISOString()
  };

  function install() {
    const parcel = global.BlacklaceParcel?.parcel;
    if (!parcel || !Array.isArray(parcel.seeds) || !global.GardenStore) return false;

    const existing = parcel.seeds.find((item) => item.id === SEED_ID);
    if (existing) Object.assign(existing, seed, {
      status: ["adventure", "harvested", "composted"].includes(existing.status) ? existing.status : seed.status,
      maturity: Math.max(Number(existing.maturity) || 0, seed.maturity),
      plantedAt: existing.plantedAt || seed.plantedAt
    });
    else parcel.seeds.unshift({ ...seed });

    global.GardenStore.registerParcel({
      id: PARCEL_ID,
      code: "PROJECT-YAEL",
      name: seed.title,
      mission: seed.objective,
      priorities: [seed.firstHarvest, "récolte textuelle", "aucune dépendance Canva"],
      version: 1,
      seeds: [{ ...seed }]
    });

    try { global.BlacklaceParcel.syncGardenDomain?.(global.BlacklaceParcel.activeSeed?.()); } catch (_) {}
    try { void global.BlacklaceParcel.writeGlobalState?.(global.BlacklaceParcel.activeSeed?.()); } catch (_) {}
    try { global.GerardScheduler?.tick?.(); } catch (_) {}
    return true;
  }

  global.YaelParcel = { PARCEL_ID, SEED_ID, seed, install };

  if (!install()) {
    global.addEventListener("load", install, { once: true });
  }
})(globalThis);
