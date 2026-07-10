const SURVIVOR_KEY = "poulpe-fiction:survivor:v1";

function loadSurvivor(){
  try {
    const stored = JSON.parse(localStorage.getItem(SURVIVOR_KEY) || "null");
    if(stored && typeof stored === "object") return stored;
  } catch (_) {}
  return {
    active:true,
    targetEuros:20,
    earnedEuros:0,
    startedAt:new Date().toISOString(),
    lastHarvestDate:null,
    harvest:null,
    attempts:[]
  };
}

function saveSurvivor(next){
  localStorage.setItem(SURVIVOR_KEY, JSON.stringify(next));
  return next;
}

function survivorSource(){
  const cuttings = typeof greenhouseCuttings === "function" ? greenhouseCuttings() : [];
  const preferred = cuttings.find(item => /livre|ebook|guide|atelier|formation|application|app/i.test(`${item?.title || ""} ${item?.summary || ""}`));
  return preferred || cuttings[0] || {
    id:"blacklace-existing-work",
    title:"Les créations déjà terminées de Benoît",
    summary:"Livres, applications, jeux et expérience multimédia déjà disponibles."
  };
}

function survivorHarvest(){
  const survivor = loadSurvivor();
  const today = todayKey();
  if(survivor.harvest && survivor.lastHarvestDate === today) return survivor.harvest;

  const source = survivorSource();
  const title = source.title || source.id || "une création existante";
  const harvest = {
    id:`survivor-${today}`,
    createdAt:new Date().toISOString(),
    source:{ id:source.id || title, title },
    status:"ready-for-human-action",
    objective:"Obtenir une première rentrée d'argent sans créer un nouveau gros projet.",
    offerTitle:"Diagnostic express IA & présence numérique",
    price:20,
    promise:"En 48 h, je vous livre un diagnostic clair de votre présence numérique et trois améliorations immédiatement applicables.",
    why:"Cette offre utilise directement l'expérience de Benoît en multimédia, formation et IA. Elle peut être proposée aujourd'hui, sans attendre que Gérard sache générer une vidéo ou publier seul.",
    deliverables:[
      "audit rapide d'un site ou d'un compte social",
      "3 priorités concrètes et expliquées simplement",
      "1 exemple réécrit ou redesigné",
      "restitution PDF courte"
    ],
    post:`Je teste cette semaine une offre simple à 20 € : un diagnostic express de votre présence numérique.\n\nJe regarde votre site ou votre compte, je repère ce qui bloque la compréhension ou la confiance, puis je vous rends 3 améliorations concrètes et un exemple retravaillé.\n\nPas de tunnel magique ni de promesse à 10 000 €. Juste un regard de formateur multimédia et de créateur assisté par IA.\n\nJ'ouvre 3 places pour commencer. Envoyez-moi « DIAGNOSTIC » en message privé.`,
    directMessage:`Bonjour, je lance un diagnostic express à 20 € pour les petites structures et créateurs. Je regarde votre présence numérique et je livre sous 48 h trois améliorations concrètes avec un exemple retravaillé. Je pensais que cela pouvait être utile pour ${title}. Je vous envoie le détail ?`,
    nextHumanStep:"Copier le texte, choisir un seul compte où le publier, puis envoyer le message à trois personnes ou structures réellement pertinentes.",
    limits:"Gérard prépare et priorise. Il ne prétend pas avoir publié, encaissé ou contacté quelqu'un tant qu'aucun connecteur autorisé ne l'a réellement fait."
  };

  saveSurvivor({ ...survivor, lastHarvestDate:today, harvest });
  return harvest;
}

function survivorText(){
  const survivor = loadSurvivor();
  const harvest = survivorHarvest();
  const remaining = Math.max(0, Number(survivor.targetEuros || 20) - Number(survivor.earnedEuros || 0));
  return [
    `🛟 Mode Survivor actif. Il reste ${remaining} € à faire entrer pour atteindre le premier objectif.`,
    "",
    `J'ai préparé aujourd'hui : « ${harvest.offerTitle} » à ${harvest.price} €.`,
    harvest.promise,
    "",
    `Action humaine minimale : ${harvest.nextHumanStep}`,
    "",
    "Je ne vais pas te demander quel est ton objectif : il est déjà connu. Je continuerai à préparer une récolte exploitable par jour tant que le mode Survivor reste actif."
  ].join("\n");
}

function renderSurvivorCard(){
  const survivor = loadSurvivor();
  if(!survivor.active || state.step !== "objective") return "";
  const harvest = survivorHarvest();
  return `<section class="survivor-card"><div class="survivor-head"><div><p class="eyebrow">🛟 Mode Survivor</p><h2>Une récolte prête aujourd'hui</h2></div><strong>${esc(harvest.price)} €</strong></div><p>${esc(harvest.promise)}</p><div class="plans"><article class="plan-item"><strong>Pourquoi celle-ci</strong><p>${esc(harvest.why)}</p></article><article class="plan-item"><strong>Ce que Benoît livre</strong><p>${harvest.deliverables.map(item=>`• ${esc(item)}`).join("<br>")}</p></article><article class="plan-item"><strong>Publication prête</strong><p>${esc(harvest.post).replace(/\n/g,"<br>")}</p></article><article class="plan-item"><strong>Message direct prêt</strong><p>${esc(harvest.directMessage)}</p></article></div><div class="actions"><button class="primary" id="copySurvivorPost">Copier la publication</button><button class="ghost" id="copySurvivorDm">Copier le message</button><button class="ghost" id="markSurvivorAttempt">J'ai tenté aujourd'hui</button></div><p class="survivor-limit">${esc(harvest.limits)}</p></section>`;
}

function bindSurvivorActions(){
  const harvest = survivorHarvest();
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  };
  const postButton = document.getElementById("copySurvivorPost");
  if(postButton) postButton.onclick=()=>copy(harvest.post);
  const dmButton = document.getElementById("copySurvivorDm");
  if(dmButton) dmButton.onclick=()=>copy(harvest.directMessage);
  const attemptButton = document.getElementById("markSurvivorAttempt");
  if(attemptButton) attemptButton.onclick=()=>{
    const survivor = loadSurvivor();
    const attempts = [...(survivor.attempts || []), { date:new Date().toISOString(), harvestId:harvest.id }].slice(-30);
    saveSurvivor({ ...survivor, attempts });
    pushChat("gerard", "🛟 Tentative notée. Je garderai ce résultat dans mon carnet et je préparerai la prochaine amélioration à partir de ce qui revient.");
    render();
  };
}

const baseGerardReply = gerardReply;
gerardReply = function(input){
  const text = String(input || "").toLowerCase();
  if(/surviv|argent|revenu|vente|vendre|20 ?€|respirer|urgence|urgent/.test(text)) return survivorText();
  const fallback = baseGerardReply(input);
  if(fallback.startsWith("🐙 Je t'écoute. Donne-moi un objectif")) return survivorText();
  return fallback;
};

const baseRender = render;
render = function(){
  baseRender();
  if(state.step !== "objective") return;
  const card = renderSurvivorCard();
  if(!card) return;
  const chat = document.querySelector(".gerard-chat");
  if(chat) chat.insertAdjacentHTML("afterend", card);
  bindSurvivorActions();
};

render();
