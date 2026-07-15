(function gardenDashboardModule(global) {
  "use strict";

  const VIEWS = [
    ["hublot", "Hublot"],
    ["parcels", "Parcelles"],
    ["missions", "Missions"],
    ["harvests", "Récoltes"],
    ["dreams", "Rêves & jeux"]
  ];

  const MISSION_FILTERS = [
    ["now", "À faire maintenant"],
    ["today", "Aujourd'hui"],
    ["week", "Cette semaine"],
    ["running", "En cours"],
    ["authorization", "En attente d'autorisation"],
    ["blocked", "Bloquées"],
    ["completed", "Terminées"]
  ];

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[char]));
  }

  function nowTime() {
    return new Date().getTime();
  }

  function timeValue(value) {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }

  function dateLabel(value) {
    if (!value) return "Non définie";
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value));
    } catch (_) {
      return value;
    }
  }

  function extractHarvestText(value) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try { return extractHarvestText(JSON.parse(trimmed)); } catch (_) {}
      }
      return trimmed.replace(/\\n/g, "\n");
    }
    if (!value || typeof value !== "object") return "";
    if (typeof value.text === "string") return extractHarvestText(value.text);
    if (value.content && typeof value.content === "object" && typeof value.content.text === "string") return extractHarvestText(value.content.text);
    return "";
  }

  function priorityRank(priority) {
    return ({ urgent: 4, high: 3, normal: 2, low: 1 })[priority] || 2;
  }

  function parcelById(data, parcelId) {
    return (data.garden.parcels || []).find((parcel) => parcel.id === parcelId) || null;
  }

  function parcelName(data, parcelId) {
    return parcelById(data, parcelId)?.name || parcelId || "Parcelle inconnue";
  }

  function seedById(data, seedId) {
    return (data.garden.seeds || []).find((seed) => seed.id === seedId) || null;
  }

  function allIssues(data) {
    const operations = data.garden.operations || [];
    const runtime = data.runtime;
    const bundles = data.returns || [];
    const issues = [];

    operations.filter((operation) => ["blocked", "failed"].includes(operation.status)).forEach((operation) => {
      issues.push({
        id: `operation:${operation.id}`,
        type: operation.status === "blocked" ? "Mission bloquée" : "Erreur mission",
        cause: operation.obstacle?.message || operation.activity || operation.status,
        parcelId: operation.parcelId,
        missionId: operation.id,
        date: operation.updatedAt || operation.createdAt,
        action: operation.status === "blocked" ? "Ouvrir la mission" : "Relancer"
      });
    });

    if (runtime?.obstacle) {
      issues.push({
        id: "runtime-obstacle",
        type: "Attente d'autorisation",
        cause: runtime.obstacle.message || runtime.obstacle.reason || "Une validation est nécessaire.",
        parcelId: runtime.parcelId,
        missionId: runtime.operationId,
        date: runtime.updatedAt,
        action: "Compléter dans l'activité"
      });
    }

    bundles.filter((bundle) => bundle.status === "incomplete" || bundle.failure).forEach((bundle) => {
      issues.push({
        id: `return:${bundle.id}`,
        type: bundle.failure ? "Mission échouée" : "Résultat incomplet",
        cause: bundle.failure?.reason || "Le résultat est incomplet.",
        parcelId: bundle.parcelId,
        missionId: bundle.missionId,
        date: bundle.createdAt,
        action: "Examiner le retour"
      });
    });

    return issues.sort((a, b) => timeValue(b.date) - timeValue(a.date));
  }

  function missions(data) {
    const operations = (data.garden.operations || []).map((operation) => {
      const seed = seedById(data, operation.seedId);
      return {
        id: operation.id,
        parcelId: operation.parcelId,
        title: seed?.title || operation.intent || "Mission Garden",
        objective: seed?.objective || operation.activity || "Préparer une récolte",
        expectedResult: seed?.firstHarvest || "",
        priority: operation.status === "blocked" ? "urgent" : "normal",
        dueAt: operation.dueAt || null,
        status: operation.status === "ready" ? "completed" : operation.status,
        bag: null,
        createdAt: operation.createdAt,
        startedAt: operation.status === "running" ? operation.updatedAt : null,
        completedAt: operation.status === "ready" ? operation.updatedAt : null,
        result: operation.activity,
        error: operation.obstacle?.message || null
      };
    });

    const draft = data.adventureDraft;
    if (draft) {
      const active = data.activeSeed;
      missionsAddUnique(operations, {
        id: draft.id,
        parcelId: active?.parcelId || "poulpe-fiction",
        title: draft.curiosity?.title || "Sac d'aventure",
        objective: draft.objective,
        expectedResult: active?.firstHarvest || "",
        priority: draft.status === "validated" ? "high" : "normal",
        dueAt: null,
        status: draft.status === "validated" ? "ready" : "draft",
        bag: draft,
        createdAt: draft.createdAt,
        startedAt: null,
        completedAt: null,
        result: null,
        error: null
      });
    }

    (data.returns || []).forEach((bundle) => {
      missionsAddUnique(operations, {
        id: bundle.missionId || bundle.id,
        parcelId: bundle.parcelId,
        title: bundle.harvests?.[0]?.title || bundle.questions?.[0]?.title || "Retour d'aventure",
        objective: bundle.rawMission?.objective || "Traiter le retour d'aventure",
        expectedResult: bundle.harvests?.[0]?.description || "",
        priority: bundle.failure ? "urgent" : "normal",
        dueAt: null,
        status: bundle.failure ? "failed" : bundle.status === "incomplete" ? "blocked" : "completed",
        bag: null,
        createdAt: bundle.createdAt,
        startedAt: null,
        completedAt: bundle.status === "ready" ? bundle.createdAt : null,
        result: bundle.harvests?.[0]?.description || bundle.failure?.reason || null,
        error: bundle.failure?.reason || null
      });
    });

    return operations.sort((a, b) => {
      const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
      if (priorityDelta) return priorityDelta;
      return timeValue(a.dueAt || a.createdAt) - timeValue(b.dueAt || b.createdAt);
    });
  }

  function missionsAddUnique(list, mission) {
    if (!mission.id || list.some((item) => item.id === mission.id)) return;
    list.push(mission);
  }

  function visibleMissions(data) {
    const filter = data.dashboard.missionFilter;
    const list = missions(data);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const endToday = start.getTime() + 24 * 60 * 60 * 1000;
    const endWeek = start.getTime() + 7 * 24 * 60 * 60 * 1000;

    return list.filter((mission) => {
      const due = timeValue(mission.dueAt);
      if (filter === "today") return due && due < endToday;
      if (filter === "week") return due && due < endWeek;
      if (filter === "running") return mission.status === "running";
      if (filter === "authorization") return mission.status === "waiting-authorization";
      if (filter === "blocked") return ["blocked", "failed"].includes(mission.status);
      if (filter === "completed") return mission.status === "completed";
      return ["urgent", "high"].includes(mission.priority) || ["ready", "running", "blocked"].includes(mission.status);
    });
  }

  function harvests(data) {
    const accepted = data.harvestState?.accepted || {};
    const gardenHarvests = (data.garden.harvests || []).map((harvest) => ({
      id: harvest.id,
      title: harvest.title,
      parcelId: harvest.parcelId,
      missionId: harvest.operationId,
      date: harvest.createdAt,
      type: "rapport",
      status: accepted[harvest.id]?.status || normalizeHarvestStatus(harvest.status),
      preview: extractHarvestText(harvest.preview || harvest.content),
      content: { text: extractHarvestText(harvest.content || harvest.preview) },
      url: harvest.url || null,
      downloadUrl: harvest.downloadUrl || null,
      link: null
    }));

    const returnHarvests = (data.returns || []).flatMap((bundle) => (bundle.harvests || []).map((harvest) => {
      const text = extractHarvestText(harvest.content || harvest.artifact || harvest.description);
      return {
        id: harvest.id,
        title: harvest.title,
        parcelId: harvest.parcelId || bundle.parcelId,
        missionId: harvest.missionId || bundle.missionId,
        date: harvest.createdAt || bundle.createdAt,
        type: normalizeHarvestType(harvest.artifactType),
        status: accepted[harvest.id]?.status || (bundle.status === "ready" ? "à-valider" : "brouillon"),
        preview: extractHarvestText(harvest.description || text),
        content: { text },
        url: harvest.url || harvest.artifact?.url || null,
        downloadUrl: harvest.downloadUrl || harvest.artifact?.downloadUrl || null,
        link: null
      };
    }));

    const packHarvests = (data.productionPacks || []).map((pack) => ({
      id: pack.id,
      title: pack.title,
      parcelId: pack.parcelId,
      missionId: pack.returnId,
      date: pack.createdAt,
      type: "landing-page",
      status: accepted[pack.id]?.status || (pack.artifacts?.some((item) => item.status === "ready") ? "prêt" : "brouillon"),
      preview: `${pack.artifacts?.length || 0} artefact(s), ${pack.publications?.length || 0} publication(s)`,
      content: { text: extractHarvestText(pack.artifacts?.find((item) => item.type === "landing-page")?.content) },
      url: pack.artifacts?.find((item) => item.url || item.artifact?.url)?.url || pack.artifacts?.find((item) => item.url || item.artifact?.url)?.artifact?.url || null,
      downloadUrl: pack.artifacts?.find((item) => item.downloadUrl || item.artifact?.downloadUrl)?.downloadUrl || pack.artifacts?.find((item) => item.downloadUrl || item.artifact?.downloadUrl)?.artifact?.downloadUrl || null,
      link: null
    }));

    return dedupeById([...packHarvests, ...returnHarvests, ...gardenHarvests])
      .sort((a, b) => timeValue(b.date) - timeValue(a.date));
  }

  function normalizeHarvestStatus(status) {
    if (status === "ready") return "prêt";
    if (status === "published") return "publié";
    if (status === "rejected") return "rejeté";
    return "brouillon";
  }

  function normalizeHarvestType(type) {
    return ({
      text: "texte",
      campaign: "campagne",
      prompt: "texte",
      audit: "rapport",
      question: "question",
      file: "fichier"
    })[type] || type || "texte";
  }

  function dedupeById(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function notebookEntries(data, parcelId) {
    const entries = [];
    (data.garden.seeds || []).filter((seed) => !parcelId || seed.parcelId === parcelId).forEach((seed) => {
      entries.push({ date: seed.createdAt, type: "Seed", title: seed.title, summary: seed.objective || seed.content, source: seed.source || "Garden", link: seed.id });
    });
    missions(data).filter((mission) => !parcelId || mission.parcelId === parcelId).forEach((mission) => {
      entries.push({ date: mission.createdAt, type: "Mission créée", title: mission.title, summary: mission.objective, source: mission.status, link: mission.id });
      if (mission.completedAt) entries.push({ date: mission.completedAt, type: "Mission terminée", title: mission.title, summary: mission.result || mission.expectedResult, source: "Mission", link: mission.id });
    });
    harvests(data).filter((harvest) => !parcelId || harvest.parcelId === parcelId).forEach((harvest) => {
      entries.push({ date: harvest.date, type: "Récolte", title: harvest.title, summary: harvest.preview, source: harvest.type, link: harvest.id });
    });
    allIssues(data).filter((issue) => !parcelId || issue.parcelId === parcelId).forEach((issue) => {
      entries.push({ date: issue.date, type: "Erreur", title: issue.type, summary: issue.cause, source: issue.action, link: issue.missionId });
    });
    (data.returns || []).filter((bundle) => !parcelId || bundle.parcelId === parcelId).forEach((bundle) => {
      (bundle.questions || []).forEach((question) => entries.push({ date: question.createdAt, type: "Question", title: question.title, summary: question.context, source: "AdventureReturn", link: question.id }));
      (bundle.learnings || []).forEach((learning) => entries.push({ date: learning.createdAt, type: "Apprentissage", title: learning.summary, summary: learning.details, source: "AdventureReturn", link: learning.id }));
      (bundle.seeds || []).forEach((seed) => entries.push({ date: seed.createdAt, type: "Nouvelle piste", title: seed.title, summary: seed.description, source: "AdventureReturn", link: seed.id }));
    });
    dreamsEntries(data).filter((dream) => !parcelId || !dream.parcelId || dream.parcelId === parcelId).forEach((dream) => {
      entries.push({ date: dream.date, type: dream.type, title: dream.title, summary: dream.text, source: "Rêves & jeux", link: null });
    });
    return entries.sort((a, b) => timeValue(b.date) - timeValue(a.date));
  }

  function dreamsEntries(data) {
    const items = [];
    Object.values(data.dreams.dreamsByDate || {}).forEach((dream) => {
      items.push({ date: dream.date, parcelId: null, type: "rêve", title: dream.title || "Rêve", text: dream.text || dream.whisper || "", outcome: dream.whisper || "" });
    });
    if (data.dreams.lastPlay) {
      items.push({
        date: data.dreams.lastPlay.date,
        parcelId: null,
        type: "essai ludique",
        title: data.dreams.lastPlay.entry?.title || "Idée jouée",
        text: data.dreams.lastPlay.hypothesis || "",
        outcome: "Laissé à mûrir"
      });
    }
    Object.values(data.attractions.items || {}).forEach((item) => {
      items.push({
        date: item.lastSeen || data.attractions.date,
        parcelId: null,
        type: (item.count || 0) >= 4 ? "idée devenue Seed possible" : "bouture",
        title: item.title || item.id,
        text: `${item.count || 0} observation(s) dans la serre`,
        outcome: (item.count || 0) >= 4 ? "Prête à préparer un sac" : "À observer"
      });
    });
    return items.sort((a, b) => timeValue(b.date) - timeValue(a.date));
  }

  function parcelCards(data) {
    return (data.garden.parcels || []).map((parcel) => {
      const parcelMissions = missions(data).filter((mission) => mission.parcelId === parcel.id);
      const issues = allIssues(data).filter((issue) => issue.parcelId === parcel.id);
      const parcelHarvests = harvests(data).filter((harvest) => harvest.parcelId === parcel.id);
      const activeMissions = parcelMissions.filter((mission) => !["completed", "cancelled"].includes(mission.status));
      const nextMission = activeMissions[0] || parcelMissions[0] || null;
      const status = parcelStatus(parcel, activeMissions, issues, parcelHarvests);
      return `<article class="garden-card parcel-card" data-open-parcel="${esc(parcel.id)}">
        <div class="garden-card-head"><span>${esc(status)}</span><small>${esc(parcel.code || parcel.id)}</small></div>
        <h3>${esc(parcel.name)}</h3>
        <p>${esc(parcel.mission || "Aucune mission de parcelle renseignée.")}</p>
        <dl class="garden-metrics">
          <div><dt>Priorité</dt><dd>${esc(parcel.priorities?.[0] || "normale")}</dd></div>
          <div><dt>Dernière activité</dt><dd>${esc(dateLabel(lastActivity(parcelMissions, parcelHarvests, issues)))}</dd></div>
          <div><dt>Échéance</dt><dd>${esc(dateLabel(nextMission?.dueAt))}</dd></div>
          <div><dt>Récolte attendue</dt><dd>${esc(seedById(data, nextMission?.bag?.curiosity?.id)?.firstHarvest || nextMission?.expectedResult || "À définir")}</dd></div>
          <div><dt>Missions actives</dt><dd>${activeMissions.length}</dd></div>
          <div><dt>Blocages</dt><dd>${issues.length}</dd></div>
        </dl>
      </article>`;
    }).join("");
  }

  function parcelStatus(parcel, activeMissions, issues, parcelHarvests) {
    if (issues.length) return "bloquée";
    if (parcelHarvests.some((harvest) => harvest.status === "prêt")) return "prête-à-récolter";
    if (activeMissions.length) return "active";
    if (parcel.archived) return "archivée";
    return "calme";
  }

  function lastActivity(parcelMissions, parcelHarvests, issues) {
    return [parcelMissions[0]?.createdAt, parcelHarvests[0]?.date, issues[0]?.date].sort((a, b) => timeValue(b) - timeValue(a))[0] || null;
  }

  function hublot(data) {
    const activeParcels = (data.garden.parcels || []).filter((parcel) => !parcel.archived);
    const allMissions = missions(data);
    const urgentMission = allMissions.find((mission) => mission.priority === "urgent" || mission.status === "blocked");
    const nextDue = allMissions.filter((mission) => mission.dueAt).sort((a, b) => timeValue(a.dueAt) - timeValue(b.dueAt))[0];
    const latestHarvest = harvests(data)[0];
    const latestDream = dreamsEntries(data)[0];
    const issues = allIssues(data);
    const runtime = data.runtime;
    const publisherConnected = runtime?.source === "remote" || runtime?.source === "remote-cache";
    const connectionLabel = `${runtime?.harvest ? "Mistral disponible" : "Mistral à vérifier"} · Publisher ${publisherConnected ? "connecté" : "non confirmé"}`;
    return `<section class="garden-dashboard-view">
      <div class="hublot-grid">
        ${metricCard(`${activeParcels.length}`, "parcelles actives", activeParcels.map((parcel) => parcel.name).join(", ") || "Aucune parcelle chargée")}
        ${metricCard(urgentMission ? "1" : "0", "mission urgente", urgentMission?.title || "Aucune urgence")}
        ${metricCard(nextDue ? dateLabel(nextDue.dueAt) : "Non définie", "prochaine échéance", nextDue ? `${parcelName(data, nextDue.parcelId)} · ${nextDue.title}` : "Aucune échéance locale")}
        ${metricCard(latestHarvest?.title || "Aucune récolte", "dernier résultat", latestHarvest?.preview || "Les retours apparaîtront ici")}
        ${metricCard(latestDream?.title || "Aucun rêve", "dernier rêve ou jeu", latestDream?.text || "Rien à signaler")}
        ${metricCard(String(issues.length), "erreurs ou attentes", issues[0]?.cause || "Aucun blocage visible")}
      </div>
      <article class="garden-card connection-summary">
        <div><p class="eyebrow">Connexions</p><h3>${esc(connectionLabel)}</h3><p>Les clés et providers restent dans Publisher. Poulpe-Fiction affiche seulement l'état utile au jardin.</p></div>
        <a class="primary garden-link" href="${esc(data.publisherUrl)}/" target="_blank" rel="noopener">Ouvrir Publisher</a>
      </article>
    </section>`;
  }

  function metricCard(value, label, detail) {
    return `<article class="garden-card metric-card"><strong>${esc(value)}</strong><span>${esc(label)}</span><p>${esc(detail)}</p></article>`;
  }

  function parcels(data) {
    const selected = data.dashboard.selectedParcelId ? parcelById(data, data.dashboard.selectedParcelId) : null;
    if (selected) return parcelNotebook(data, selected);
    return `<section class="garden-dashboard-view"><div class="garden-card-grid">${parcelCards(data) || emptyState("Aucune parcelle chargée", "Choisis une Seed dans la parcelle Blacklace pour synchroniser le Garden local.")}</div></section>`;
  }

  function parcelNotebook(data, parcel) {
    const entries = notebookEntries(data, parcel.id).slice(0, 40);
    const parcelSeeds = (data.garden.seeds || []).filter((seed) => seed.parcelId === parcel.id);
    const parcelMissions = missions(data).filter((mission) => mission.parcelId === parcel.id);
    const parcelHarvests = harvests(data).filter((harvest) => harvest.parcelId === parcel.id);
    const issues = allIssues(data).filter((issue) => issue.parcelId === parcel.id);
    return `<section class="garden-dashboard-view">
      <button class="ghost compact-back" data-open-parcel="">Retour aux parcelles</button>
      <article class="garden-card parcel-notebook">
        <p class="eyebrow">Carnet de parcelle</p>
        <h2>${esc(parcel.name)}</h2>
        <p>${esc(parcel.mission || "Aucune mission décrite.")}</p>
        <div class="notebook-tabs">
          ${summaryPill("Seeds", parcelSeeds.length)}
          ${summaryPill("Missions", parcelMissions.length)}
          ${summaryPill("Sacs", parcelMissions.filter((mission) => mission.bag).length)}
          ${summaryPill("Récoltes", parcelHarvests.length)}
          ${summaryPill("Erreurs", issues.length)}
        </div>
      </article>
      <div class="timeline">${entries.map(timelineEntry).join("") || emptyState("Carnet vide", "Les observations, missions, récoltes et apprentissages apparaîtront ici.")}</div>
    </section>`;
  }

  function summaryPill(label, value) {
    return `<span><strong>${value}</strong>${esc(label)}</span>`;
  }

  function timelineEntry(entry) {
    return `<article class="timeline-entry">
      <time>${esc(dateLabel(entry.date))}</time>
      <div><strong>${esc(entry.type)} · ${esc(entry.title)}</strong><p>${esc(entry.summary)}</p><small>${esc(entry.source || "")}${entry.link ? ` · ${esc(entry.link)}` : ""}</small></div>
    </article>`;
  }

  function missionsView(data) {
    const list = visibleMissions(data);
    const filters = MISSION_FILTERS.map(([id, label]) => `<button class="garden-filter${data.dashboard.missionFilter === id ? " active" : ""}" data-mission-filter="${esc(id)}">${esc(label)}</button>`).join("");
    return `<section class="garden-dashboard-view">
      <div class="garden-filters">${filters}</div>
      <div class="garden-list">${list.map((mission) => missionCard(data, mission)).join("") || emptyState("Aucune mission dans ce filtre", "Les sacs validés, opérations Garden et retours d'aventure alimentent cette liste.")}</div>
    </section>`;
  }

  function missionCard(data, mission) {
    const overdue = mission.dueAt && timeValue(mission.dueAt) < nowTime() && !["completed", "cancelled"].includes(mission.status);
    return `<article class="garden-card mission-card${overdue ? " overdue" : ""}">
      <div class="garden-card-head"><span>${esc(mission.status)}</span><small>${esc(mission.priority)}</small></div>
      <h3>${esc(mission.title)}</h3>
      <p>${esc(mission.objective)}</p>
      <dl class="garden-metrics">
        <div><dt>Parcelle</dt><dd>${esc(parcelName(data, mission.parcelId))}</dd></div>
        <div><dt>Résultat attendu</dt><dd>${esc(mission.expectedResult || "À définir")}</dd></div>
        <div><dt>Échéance</dt><dd>${esc(overdue ? `Dépassée · ${dateLabel(mission.dueAt)}` : dateLabel(mission.dueAt))}</dd></div>
      </dl>
      ${mission.error ? `<div class="garden-alert error"><strong>Problème</strong><span>${esc(mission.error)}</span></div>` : ""}
      <div class="garden-actions compact">
        <button class="ghost" disabled>Marquer urgent</button>
        <button class="ghost" disabled>Définir une échéance</button>
        <button class="ghost" disabled>Mettre en pause</button>
        <button class="ghost" disabled>Relancer</button>
        <button class="ghost" disabled>Ouvrir le sac</button>
        <button class="ghost" disabled>Voir le résultat</button>
      </div>
    </article>`;
  }

  function harvestsView(data) {
    const list = harvests(data);
    return `<section class="garden-dashboard-view"><div class="garden-list">${list.map((harvest) => harvestCard(data, harvest)).join("") || emptyState("Aucune récolte", "Les retours d'aventure et Production Packs apparaîtront ici.")}</div></section>`;
  }

  function harvestCard(data, harvest) {
    const text = extractHarvestText(harvest.content);
    const canOpenText = Boolean(text);
    const canOpenCanva = Boolean(harvest.url);
    const actions = [
      canOpenText ? `<button class="ghost" data-open-harvest="${esc(harvest.id)}">Examiner</button>` : "",
      canOpenText ? `<button class="ghost" data-copy-harvest="${esc(harvest.id)}">Copier</button>` : "",
      canOpenCanva ? `<a class="primary garden-link" href="${esc(harvest.url)}" target="_blank" rel="noopener">Ouvrir dans Canva</a>` : "",
      harvest.downloadUrl ? `<a class="primary garden-link" href="${esc(harvest.downloadUrl)}" download>Télécharger</a>` : "",
      `<button class="ghost" data-accept-harvest="${esc(harvest.id)}">${harvest.status === "accepted" ? "Récolte acceptée" : "Accepter"}</button>`,
      `<button class="ghost" data-improve-harvest="${esc(harvest.id)}">Demander une amélioration</button>`
    ].join("");
    return `<article class="garden-card harvest-card" data-harvest-card="${esc(harvest.id)}">
      <p class="harvest-kicker">🌾 Nouvelle récolte</p>
      <div class="garden-card-head"><span>${esc(harvest.status)}</span><small>${esc(harvest.type)}</small></div>
      <h3>${esc(harvest.title)}</h3>
      <p>${esc(harvest.preview || "Aucun aperçu disponible.")}</p>
      ${text ? `<pre class="harvest-content">${esc(text)}</pre>` : ""}
      <dl class="garden-metrics">
        <div><dt>Parcelle</dt><dd>${esc(parcelName(data, harvest.parcelId))}</dd></div>
        <div><dt>Mission source</dt><dd>${esc(harvest.missionId || "Non liée")}</dd></div>
        <div><dt>Date</dt><dd>${esc(dateLabel(harvest.date))}</dd></div>
      </dl>
      <div class="garden-actions compact">${actions}</div>
      <form class="harvest-improvement-form" data-improve-form="${esc(harvest.id)}" hidden>
        <label>Consigne d'amélioration<textarea name="instruction" rows="3"></textarea></label>
        <div class="garden-actions compact"><button class="primary" type="submit">Envoyer</button><button class="ghost" type="button" data-cancel-improve="${esc(harvest.id)}">Annuler</button></div>
      </form>
    </article>`;
  }

  function openHarvestDetail(harvest) {
    const text = extractHarvestText(harvest?.content);
    if (!text) return;
    document.querySelector(".harvest-detail-panel")?.remove?.();
    const root = document.querySelector(".garden-dashboard") || document.getElementById("root");
    if (!root) return;
    root.insertAdjacentHTML("beforeend", `<aside class="harvest-detail-panel" role="dialog" aria-modal="false" aria-label="Récolte examinée"><article class="garden-card harvest-detail-card"><h2>${esc(harvest.title)}</h2><pre class="harvest-content">${esc(text)}</pre><div class="garden-actions compact"><button class="ghost" data-close-harvest-detail>Fermer</button><button class="primary" data-copy-open-harvest="${esc(harvest.id)}">Copier</button></div></article></aside>`);
    const panel = root.querySelector(".harvest-detail-panel");
    const close = panel?.querySelector("[data-close-harvest-detail]");
    if (close) close.onclick = () => panel.remove();
    const copy = panel?.querySelector("[data-copy-open-harvest]");
    if (copy) copy.onclick = async () => {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(text);
      copy.textContent = "Copié";
    };
  }

  function dreamsView(data) {
    const list = dreamsEntries(data);
    return `<section class="garden-dashboard-view"><div class="garden-list">${list.map((item) => `<article class="garden-card dream-card"><div class="garden-card-head"><span>${esc(item.type)}</span><small>${esc(dateLabel(item.date))}</small></div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p><small>${esc(item.outcome || "")}</small></article>`).join("") || emptyState("Aucun rêve ou jeu", "Les rêves, essais ludiques et boutures laissées à mûrir apparaîtront ici.")}</div></section>`;
  }

  function emptyState(title, detail) {
    return `<article class="garden-card empty-state"><h3>${esc(title)}</h3><p>${esc(detail)}</p></article>`;
  }

  function viewContent(data) {
    if (data.dashboard.selectedView === "parcels") return parcels(data);
    if (data.dashboard.selectedView === "missions") return missionsView(data);
    if (data.dashboard.selectedView === "harvests") return harvestsView(data);
    if (data.dashboard.selectedView === "dreams") return dreamsView(data);
    return hublot(data);
  }

  function renderDashboard(data) {
    const nav = VIEWS.map(([id, label]) => `<button class="garden-nav-item${data.dashboard.selectedView === id ? " active" : ""}" data-garden-view="${esc(id)}">${esc(label)}</button>`).join("");
    return `<section class="garden-dashboard">
      <div class="garden-dashboard-top">
        <div><p class="eyebrow">Garden</p><h2>${esc(VIEWS.find(([id]) => id === data.dashboard.selectedView)?.[1] || "Hublot")}</h2></div>
        <a href="${esc(data.publisherUrl)}/" target="_blank" rel="noopener">Publisher ↗</a>
      </div>
      <nav class="garden-nav">${nav}</nav>
      ${viewContent(data)}
    </section>`;
  }

  function mount() {
    if (!global.GardenPersistence) return;
    const root = document.getElementById("root");
    if (!root) return;
    const data = global.GardenPersistence.snapshot();
    let dashboard = document.querySelector(".garden-dashboard");
    if (!dashboard) {
      root.insertAdjacentHTML("beforebegin", renderDashboard(data));
    } else {
      dashboard.outerHTML = renderDashboard(data);
    }
    bind();
  }

  function bind() {
    document.querySelectorAll("[data-garden-view]").forEach((button) => {
      button.onclick = () => global.GardenPersistence.selectView(button.dataset.gardenView);
    });
    document.querySelectorAll("[data-open-parcel]").forEach((button) => {
      button.onclick = () => global.GardenPersistence.selectParcel(button.dataset.openParcel || null);
    });
    document.querySelectorAll("[data-mission-filter]").forEach((button) => {
      button.onclick = () => global.GardenPersistence.setMissionFilter(button.dataset.missionFilter);
    });
    document.querySelectorAll("[data-open-harvest]").forEach((button) => {
      button.onclick = () => {
        const data = global.GardenPersistence.snapshot();
        openHarvestDetail(harvests(data).find((harvest) => harvest.id === button.dataset.openHarvest));
      };
    });
    document.querySelectorAll("[data-copy-harvest]").forEach((button) => {
      button.onclick = async () => {
        const data = global.GardenPersistence.snapshot();
        const harvest = harvests(data).find((item) => item.id === button.dataset.copyHarvest);
        const text = extractHarvestText(harvest?.content);
        if (!text || !navigator.clipboard) return;
        await navigator.clipboard.writeText(text);
        button.textContent = "Copié";
      };
    });
    document.querySelectorAll("[data-accept-harvest]").forEach((button) => {
      button.onclick = () => {
        global.GardenPersistence.acceptHarvest?.(button.dataset.acceptHarvest);
        mount();
      };
    });
    document.querySelectorAll("[data-improve-harvest]").forEach((button) => {
      button.onclick = () => {
        const form = document.querySelector(`[data-improve-form="${button.dataset.improveHarvest}"]`);
        if (form) form.hidden = false;
      };
    });
    document.querySelectorAll("[data-cancel-improve]").forEach((button) => {
      button.onclick = () => {
        const form = document.querySelector(`[data-improve-form="${button.dataset.cancelImprove}"]`);
        if (form) form.hidden = true;
      };
    });
    document.querySelectorAll("[data-improve-form]").forEach((form) => {
      form.onsubmit = (event) => {
        event.preventDefault();
        const data = global.GardenPersistence.snapshot();
        const harvest = harvests(data).find((item) => item.id === form.dataset.improveForm);
        const instruction = String(form.elements?.instruction?.value || "").trim();
        if (!instruction) return;
        global.GardenPersistence.requestHarvestImprovement?.({
          harvestId: harvest?.id,
          missionId: harvest?.missionId,
          parcelId: harvest?.parcelId,
          title: harvest?.title,
          content: instruction
        });
        mount();
      };
    });
  }

  global.GardenDashboard = { mount, missions, harvests, notebookEntries, allIssues, extractHarvestText, openHarvestDetail };

  const baseRender = global.render;
  global.render = function renderWithGardenDashboard() {
    baseRender();
    mount();
  };

  mount();
})(globalThis);
