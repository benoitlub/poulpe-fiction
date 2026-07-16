(function yaelParcelModule(global) {
  "use strict";

  const SEED_ID = "yael-prospection";
  const seed = {
    id: SEED_ID,
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
    if (!parcel || !Array.isArray(parcel.seeds)) return false;

    const existing = parcel.seeds.find((item) => item.id === SEED_ID);
    if (existing) Object.assign(existing, seed, {
      status: ["adventure", "harvested", "composted"].includes(existing.status) ? existing.status : seed.status,
      maturity: Math.max(Number(existing.maturity) || 0, seed.maturity),
      plantedAt: existing.plantedAt || seed.plantedAt
    });
    else parcel.seeds.unshift(seed);

    try { global.BlacklaceParcel.syncGardenDomain?.(global.BlacklaceParcel.activeSeed?.()); } catch (_) {}
    try { void global.BlacklaceParcel.writeGlobalState?.(global.BlacklaceParcel.activeSeed?.()); } catch (_) {}
    try { global.GerardScheduler?.tick?.(); } catch (_) {}
    return true;
  }

  global.YaelParcel = { SEED_ID, seed, install };

  if (!install()) {
    global.addEventListener("load", install, { once: true });
  }
})(globalThis);
