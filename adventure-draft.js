(function adventureDraftModule(global) {
  "use strict";

  const STORAGE_KEY = "poulpe-fiction:adventure-draft:v1";
  const LEGACY_KEY = "poulpe-fiction:adventure-urge:v1";
  const VALID_STATUSES = new Set(["prepared", "validated", "cancelled"]);

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeStrings(value) {
    return Array.isArray(value)
      ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];
  }

  function normalizeEntry(value) {
    if (!value || typeof value !== "object") return null;
    const id = typeof value.id === "string" ? value.id.trim() : "";
    const title = typeof value.title === "string" ? value.title.trim() : id;
    if (!id) return null;
    return {
      id,
      title: title || id,
      count: Number.isFinite(value.count) ? Number(value.count) : 0,
    };
  }

  function create(input) {
    const entry = normalizeEntry(input?.curiosity || input?.entry);
    if (!entry) throw new Error("AdventureDraft requires a curiosity entry.");

    const createdAt = typeof input.createdAt === "string" ? input.createdAt : nowIso();
    const status = VALID_STATUSES.has(input.status) ? input.status : "prepared";
    const grafts = normalizeStrings(input.grafts);
    const picnic = normalizeStrings(input.picnic);

    return {
      version: 1,
      id: typeof input.id === "string" && input.id ? input.id : `adventure_${Date.now()}`,
      status,
      curiosity: entry,
      objective: typeof input.objective === "string" ? input.objective.trim() : "",
      bag: normalizeStrings(input.bag),
      picnic,
      grafts,
      limits: normalizeStrings(input.limits),
      gardenerValidation: status === "validated" ? {
        validatedAt: typeof input.gardenerValidation?.validatedAt === "string"
          ? input.gardenerValidation.validatedAt
          : nowIso(),
        note: typeof input.gardenerValidation?.note === "string"
          ? input.gardenerValidation.note
          : "",
      } : null,
      note: typeof input.note === "string" ? input.note : "",
      createdAt,
      updatedAt: nowIso(),
    };
  }

  function isValid(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      value.version === 1 &&
      typeof value.id === "string" &&
      VALID_STATUSES.has(value.status) &&
      normalizeEntry(value.curiosity) &&
      typeof value.objective === "string" &&
      Array.isArray(value.bag) &&
      Array.isArray(value.picnic) &&
      Array.isArray(value.grafts) &&
      Array.isArray(value.limits)
    );
  }

  function migrateLegacy(value) {
    if (!value || typeof value !== "object" || !value.entry) return null;
    const grafts = normalizeStrings(value.picnic)
      .filter((item) => item.toLowerCase().startsWith("greffon "))
      .map((item) => item.replace(/^greffon\s+/i, ""));

    return create({
      id: `adventure_${value.date || Date.now()}`,
      status: "prepared",
      entry: value.entry,
      objective: value.wish || "",
      bag: value.bag,
      picnic: value.picnic,
      grafts,
      limits: ["Aucune action sensible sans validation du jardinier"],
      note: value.note || "Ancienne envie d'aventure migrée.",
      createdAt: value.date ? `${value.date}T00:00:00.000Z` : undefined,
    });
  }

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (isValid(stored)) return stored;

      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      const migrated = migrateLegacy(legacy);
      if (migrated) {
        save(migrated);
        localStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
    } catch (_) {}
    return null;
  }

  function save(draft) {
    if (!draft) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
      return null;
    }
    const normalized = create(draft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function validate(draft, note = "") {
    if (!isValid(draft)) throw new Error("Cannot validate an invalid AdventureDraft.");
    return save({
      ...draft,
      status: "validated",
      gardenerValidation: { validatedAt: nowIso(), note },
    });
  }

  function cancel(draft, note = "") {
    if (!isValid(draft)) throw new Error("Cannot cancel an invalid AdventureDraft.");
    return save({ ...draft, status: "cancelled", note: note || draft.note });
  }

  global.AdventureDraft = { STORAGE_KEY, create, isValid, load, save, validate, cancel };

  loadAdventureUrge = function loadAdventureDraftCompat() {
    return global.AdventureDraft.load();
  };

  saveAdventureUrge = function saveAdventureDraftCompat(value) {
    const saved = value ? global.AdventureDraft.save(value) : global.AdventureDraft.save(null);
    state.adventureUrge = saved;
    return saved;
  };

  prepareAdventureBag = function prepareAdventureDraft() {
    const entry = adventureCandidate() || topIntrigue();
    if (!entry) return;
    const grafts = suggestedGrafts(entry);
    const draft = global.AdventureDraft.create({
      entry,
      objective: adventureWish(entry),
      bag: adventureBagFor(entry),
      picnic: ["quelques tokens Mistral pour mettre l'intention en mots", ...grafts.map((graft) => `greffon ${graft}`)],
      grafts,
      limits: [
        "Aucun départ sans validation du jardinier",
        "Aucune action sensible implicite",
        "Retour obligatoire avec récolte, trace ou apprentissage",
      ],
      note: "Je ne pars pas encore. Le sac est prêt, mais l'aventure reste un brouillon.",
    });
    saveAdventureUrge(draft);
    pushChat("gerard", `🎒 J'ai préparé un brouillon d'aventure pour « ${entry.title || entry.id} ». Le sac, le pique-nique et les limites sont visibles. Je ne pars pas encore.`);
    render();
  };

  clearAdventureUrge = function clearAdventureDraft() {
    saveAdventureUrge(null);
    const intrigue = topIntrigue();
    if (intrigue) state.playground = { mode: "mature", date: todayKey(), entry: intrigue, hypothesis: playHypothesis(intrigue) };
    render();
  };

  renderAdventureUrge = function renderAdventureDraft() {
    if (state.greenhouse.status !== "ready") return "";
    const draft = global.AdventureDraft.load();
    const candidate = adventureCandidate();
    if (!draft && !candidate) return "";

    if (draft) {
      const title = draft.curiosity.title || draft.curiosity.id;
      return `<section class="adventure-urge prepared"><p class="eyebrow">🎒 AdventureDraft · ${esc(draft.status)}</p><h3>Le brouillon d'aventure est prêt.</h3><p>Objectif : ${esc(draft.objective)}</p><div class="adventure-grid"><article><strong>Dans mon sac</strong><ul>${draft.bag.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></article><article><strong>Pique-nique envisagé</strong><ul>${draft.picnic.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></article><article><strong>Greffons proposés</strong><ul>${draft.grafts.map((item) => `<li>${esc(item)}</li>`).join("") || "<li>Aucun</li>"}</ul></article><article><strong>Limites</strong><ul>${draft.limits.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></article></div><small>${esc(draft.note)}</small><div class="play-actions"><button class="ghost" id="clearAdventureUrge">🌱 Laisser au jardin</button><button class="primary" disabled title="La validation et le départ arrivent à l'étape suivante">Valider plus tard</button></div><p class="eyebrow">Curiosité : ${esc(title)} · Brouillon ${esc(draft.id)}</p></section>`;
    }

    const title = candidate?.title || candidate?.id || "cette bouture";
    return `<section class="adventure-urge"><p class="eyebrow">🎒 Une envie d'aventure grandit</p><h3>Je reviens souvent vers « ${esc(title)} ».</h3><p>Ce n'est plus seulement une curiosité. J'ai peut-être envie de ${esc(adventureWish(candidate))}.</p><div class="adventure-grid"><article><strong>Avant tout départ</strong><ul><li>préparer un objectif explicite ;</li><li>rassembler le sac ;</li><li>annoncer le pique-nique et les greffons ;</li><li>écrire les limites.</li></ul></article><article><strong>Pas encore une mission</strong><p>La prochaine action crée seulement un AdventureDraft.</p></article></div><div class="play-actions"><button class="ghost" id="clearAdventureUrge">👀 Continuer à observer</button><button class="primary" id="prepareAdventureBag">🎒 Préparer le brouillon</button></div></section>`;
  };

  state.adventureUrge = global.AdventureDraft.load();
  render();
})(globalThis);
