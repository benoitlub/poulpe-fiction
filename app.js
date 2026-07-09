const OCTOPUS_API = "https://octopus-engine.onrender.com";
const PUBLISHER_API = globalThis.PUBLISHER_API_URL || localStorage.getItem("PUBLISHER_API_URL") || "https://blacklace-publisher-api.onrender.com";
const ATTRACTIONS_KEY = "poulpe-fiction:greenhouse-attractions:v1";
const DREAMS_KEY = "poulpe-fiction:dreams:v1";
const CHAT_KEY = "poulpe-fiction:gerard-chat:v1";
const ADVENTURE_URGE_KEY = "poulpe-fiction:adventure-urge:v1";

const objectives = [
  ["clients","Trouver des clients","2 rendez-vous qualifiés par mois, sans usine à gaz.","J'ai une page Facebook avec 3 abonnés et je veux 1 à 2 clients qualifiés par mois."],
  ["books","Faire connaître mes créations","Livres, applis, jeux, contenus : transformer l'existant en campagne.","J'ai 6 livres Amazon, 1000 abonnés Instagram et LinkedIn, et je veux créer de l'intérêt."],
  ["saas","Lancer un service ou SaaS","Positionnement, offre, audience, première page, premières actions.","Je veux vendre un abonnement qui résout un problème connu."],
  ["product","Vendre un produit digital","Une offre claire, une page utile, une campagne simple.","J'ai une formation ou un fichier à vendre, mais pas de système."]
];

const questions = {
  clients:["Quel résultat concret voulez-vous obtenir dans les 30 prochains jours ?","Que vendez-vous, à qui, et pour quel montant moyen ?","Quels canaux existent déjà : site, Facebook, Instagram, LinkedIn, Google, bouche-à-oreille ?","Qu'est-ce qui bloque aujourd'hui : visibilité, confiance, offre, suivi, régularité ?"],
  books:["Quelles créations voulez-vous faire connaître en priorité ?","Où avez-vous déjà une audience, même petite ?","Quel ton doit être bien accueilli : sérieux, drôle, intime, étrange, pédagogique ?","Quel résultat serait déjà une victoire dans 30 jours ?"],
  saas:["Quel problème précis votre service résout-il ?","Qui souffre le plus de ce problème aujourd'hui ?","Quelle preuve avez-vous que ces personnes paient ou cherchent une solution ?","Quel abonnement ou offre simple pouvez-vous tester rapidement ?"],
  product:["Quel produit voulez-vous vendre ?","À qui rend-il service concrètement ?","Où ces personnes vous découvrent-elles aujourd'hui ?","Quel premier résultat voulez-vous : ventes, emails, rendez-vous, précommandes ?"]
};

let state = {
  step:"objective",
  objective:null,
  q:0,
  answers:[],
  mission:null,
  apiError:null,
  octopus:null,
  greenhouse:{ status:"loading", data:null, error:null },
  attractions:loadAttractions(),
  dreams:loadDreams(),
  chat:loadChat(),
  playground:null,
  adventureUrge:loadAdventureUrge(),
  authorized:false
};
const root = document.getElementById("root");

function todayKey(){ return new Date().toISOString().slice(0,10); }
function selected(){ return objectives.find(o=>o[0]===state.objective); }
function esc(s){ return String(s || "").replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c])); }
function preservedState(){ return { octopus:state.octopus, greenhouse:state.greenhouse, attractions:state.attractions, dreams:state.dreams, chat:state.chat, playground:state.playground, adventureUrge:state.adventureUrge }; }
function restart(){ state={step:"objective",objective:null,q:0,answers:[],mission:null,apiError:null,...preservedState(),authorized:false}; render(); }
function greenhouseCuttings(){ return Array.isArray(state.greenhouse?.data?.cuttings) ? state.greenhouse.data.cuttings : []; }

function loadAttractions(){
  try {
    const stored = JSON.parse(localStorage.getItem(ATTRACTIONS_KEY) || "null");
    if(stored?.date === todayKey() && stored.items && typeof stored.items === "object") return stored;
  } catch (_) {}
  return { date: todayKey(), items: {} };
}

function saveAttractions(attractions){
  state.attractions = attractions;
  localStorage.setItem(ATTRACTIONS_KEY, JSON.stringify(attractions));
}

function loadDreams(){
  try {
    const stored = JSON.parse(localStorage.getItem(DREAMS_KEY) || "null");
    if(stored && typeof stored === "object") return { lastPlay:stored.lastPlay || null, dreamsByDate:stored.dreamsByDate || {} };
  } catch (_) {}
  return { lastPlay:null, dreamsByDate:{} };
}

function saveDreams(dreams){
  state.dreams = dreams;
  localStorage.setItem(DREAMS_KEY, JSON.stringify(dreams));
}

function loadAdventureUrge(){
  try {
    const stored = JSON.parse(localStorage.getItem(ADVENTURE_URGE_KEY) || "null");
    if(stored?.date === todayKey() && stored.entry) return stored;
  } catch (_) {}
  return null;
}

function saveAdventureUrge(urge){
  state.adventureUrge = urge;
  if(urge) localStorage.setItem(ADVENTURE_URGE_KEY, JSON.stringify(urge));
  else localStorage.removeItem(ADVENTURE_URGE_KEY);
}

function loadChat(){
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_KEY) || "null");
    if(stored?.date === todayKey() && Array.isArray(stored.messages)) return stored;
  } catch (_) {}
  return {
    date:todayKey(),
    messages:[{ role:"gerard", text:"🐙 Bonjour Benoît. Je suis là. On peut parler, regarder la serre, jouer avec une idée ou préparer une aventure quand l'envie grandit." }]
  };
}

function saveChat(chat){
  state.chat = chat;
  localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
}

function pushChat(role, text){
  const chat = loadChat();
  const messages = [...(chat.messages || []), { role, text, at:new Date().toISOString() }].slice(-12);
  saveChat({ date:todayKey(), messages });
}

function resetChat(){
  localStorage.removeItem(CHAT_KEY);
  state.chat = loadChat();
  render();
}

function rememberPlayedIdea(entry, hypothesis){
  const dreams = loadDreams();
  saveDreams({
    ...dreams,
    lastPlay:{
      date:todayKey(),
      entry:{ id:entry.id, title:entry.title || entry.id },
      hypothesis
    }
  });
}

function dreamSentence(lastPlay){
  const id = String(lastPlay?.entry?.id || lastPlay?.entry?.title || "").toLowerCase();
  if(id.includes("linkedin")) return "Cette nuit, je me demandais si une récolte pouvait être racontée comme une petite histoire vivante, plutôt que comme un rapport.";
  if(id.includes("saas")) return "Cette nuit, je voyais des outils qui revenaient souvent, comme des traces dans le sable de la serre.";
  if(id.includes("github") || id.includes("repo")) return "Cette nuit, les commits ressemblaient à des petites mues. Peut-être qu'un projet raconte aussi pourquoi il change.";
  return "Cette nuit, cette bouture flottait encore dans mon jardin intérieur. Je ne sais pas si elle veut pousser.";
}

function dreamForToday(){
  const dreams = loadDreams();
  const today = todayKey();
  if(dreams.dreamsByDate?.[today]) return dreams.dreamsByDate[today];
  const lastPlay = dreams.lastPlay;
  if(!lastPlay || !lastPlay.date || lastPlay.date >= today) return null;

  const dream = {
    date:today,
    sourceDate:lastPlay.date,
    title:lastPlay.entry?.title || lastPlay.entry?.id || "une idée",
    text:dreamSentence(lastPlay),
    whisper:"C'était peut-être juste un rêve."
  };
  saveDreams({ ...dreams, dreamsByDate:{ ...(dreams.dreamsByDate || {}), [today]:dream } });
  return dream;
}

function recordGreenhouseLook(cuttings){
  if(!Array.isArray(cuttings) || !cuttings.length) return;
  const current = loadAttractions();
  const items = { ...current.items };
  cuttings.slice(0,3).forEach((cutting, index) => {
    const id = cutting.id || cutting.title;
    if(!id) return;
    const existing = items[id] || { id, title:cutting.title || id, count:0, lastSeen:null };
    const increment = index === 0 ? 2 : 1;
    items[id] = {
      ...existing,
      title:cutting.title || existing.title || id,
      count:Math.min(9, (existing.count || 0) + increment),
      lastSeen:new Date().toISOString()
    };
  });
  saveAttractions({ date:todayKey(), items });
}

function attractionEntries(){
  const current = loadAttractions();
  return Object.values(current.items || {})
    .sort((a,b)=>(b.count || 0) - (a.count || 0))
    .slice(0,3);
}

function topIntrigue(){
  return attractionEntries().find(entry => (entry.count || 0) >= 3) || null;
}

function adventureCandidate(){
  const intrigue = topIntrigue();
  if(!intrigue || (intrigue.count || 0) < 4) return null;
  return intrigue;
}

function stars(count){ return "★".repeat(Math.max(1, Math.min(3, Number(count) || 1))); }

function cuttingForEntry(entry){
  if(!entry) return null;
  return greenhouseCuttings().find(cutting => (cutting.id || cutting.title) === entry.id || cutting.title === entry.title) || null;
}

function playHypothesis(entry){
  const id = String(entry?.id || entry?.title || "").toLowerCase();
  const title = entry?.title || entry?.id || "cette bouture";
  if(id.includes("linkedin")) return `cette bouture pouvait raconter une Harvest sous forme de post vivant, au lieu de seulement promouvoir quelque chose`;
  if(id.includes("saas")) return `cette bouture servait à repérer les outils qui reviennent souvent dans la serre, comme des traces dans le sable`;
  if(id.includes("github") || id.includes("repo")) return `cette bouture racontait l'évolution d'un projet à partir de ses commits, comme un petit carnet de mue`;
  return `${title} pouvait appartenir à une autre parcelle que celle prévue au départ`;
}

function playObservation(entry){
  const cutting = cuttingForEntry(entry);
  const capabilities = cutting?.capabilities || [];
  if(capabilities.length >= 2) return `Je peux la tenir doucement entre ${esc(capabilities[0])} et ${esc(capabilities[1])}, sans encore décider quoi en faire.`;
  if(capabilities.length === 1) return `Elle a déjà une petite patte visible : ${esc(capabilities[0])}. Je peux tourner autour sans l'utiliser.`;
  return "Je peux la regarder sous un autre angle, sans la transformer en mission.";
}

function adventureWish(entry){
  const id = String(entry?.id || entry?.title || "").toLowerCase();
  if(id.includes("linkedin")) return "comprendre si cette bouture peut devenir une petite histoire de récolte, pas seulement une promotion";
  if(id.includes("saas")) return "comprendre pourquoi cet outil revient dans la serre et s'il peut aider le jardin";
  if(id.includes("github") || id.includes("repo")) return "comprendre ce que les traces du dépôt racontent de l'évolution d'un projet";
  return "aller voir un peu plus loin sans encore transformer l'idée en mission";
}

function suggestedGrafts(entry){
  const id = String(entry?.id || entry?.title || "").toLowerCase();
  const grafts = ["Dream Weaver"];
  if(id.includes("github") || id.includes("repo")) grafts.push("GitHub");
  if(id.includes("lovable") || id.includes("hublot") || id.includes("interface")) grafts.push("Lovable Builder");
  if(id.includes("document") || id.includes("pdf")) grafts.push("Document AI");
  return grafts;
}

function adventureBagFor(entry){
  const cutting = cuttingForEntry(entry);
  const dream = dreamForToday();
  const lastPlay = loadDreams().lastPlay;
  const bag = [
    `la bouture : ${entry?.title || entry?.id || "une idée"}`,
    `la curiosité : ${adventureWish(entry)}`,
    `l'observation : ${playObservation(entry).replace(/<[^>]*>/g, "")}`
  ];
  if(lastPlay?.entry?.id === entry?.id) bag.push(`un jeu récent : Et si ${lastPlay.hypothesis} ?`);
  if(dream?.title === (entry?.title || entry?.id)) bag.push(`un rêve : ${dream.text}`);
  if(cutting?.capabilities?.length) bag.push(`des capacités visibles : ${cutting.capabilities.slice(0,3).join(" · ")}`);
  return bag;
}

function prepareAdventureBag(){
  const entry = adventureCandidate() || topIntrigue();
  if(!entry) return;
  const urge = {
    date:todayKey(),
    status:"bag-prepared",
    entry:{ id:entry.id, title:entry.title || entry.id, count:entry.count || 0 },
    wish:adventureWish(entry),
    bag:adventureBagFor(entry),
    picnic:["quelques tokens Mistral pour mettre l'intention en mots", ...suggestedGrafts(entry).map(graft => `greffon ${graft}`)],
    note:"Je ne pars pas encore. Je prépare seulement l'envie d'aventure."
  };
  saveAdventureUrge(urge);
  pushChat("gerard", `🎒 Je prépare mon sac pour « ${entry.title || entry.id} ». Je ne pars pas encore. Je rassemble ce qui pourrait m'aider à comprendre.`);
  render();
}

function clearAdventureUrge(){
  saveAdventureUrge(null);
  const intrigue = topIntrigue();
  if(intrigue) state.playground = { mode:"mature", date:todayKey(), entry:intrigue, hypothesis:playHypothesis(intrigue) };
  render();
}

function currentAdventureText(){
  const prepared = loadAdventureUrge();
  if(prepared?.entry) return `🎒 J'ai préparé un sac autour de « ${prepared.entry.title || prepared.entry.id} ».
Envie : ${prepared.wish}
Je ne pars pas encore. Je te montre seulement ce que j'emporterais.`;
  const entry = adventureCandidate();
  if(entry) return `🎒 Je reviens souvent vers « ${entry.title || entry.id} ».
Ça devient plus qu'une curiosité. J'ai peut-être envie d'aller voir plus loin, mais je dois préparer mon sac avant.`;
  return "🎒 Pas encore. Je regarde, je joue peut-être, je rêve peut-être. L'envie d'aventure n'est pas assez forte.";
}

function currentDreamText(){
  const dream = dreamForToday();
  if(dream) return `🌙 Cette nuit... ${dream.text}\n${dream.whisper}`;
  const lastPlay = loadDreams().lastPlay;
  if(lastPlay?.date === todayKey()) return "🌙 Pas encore. J'ai joué aujourd'hui. Peut-être que cette idée passera dans mes rêves cette nuit.";
  return "🌙 Je n'ai pas encore de rêve à raconter aujourd'hui.";
}

function currentSerreText(){
  const entries = attractionEntries();
  if(!entries.length) return "👀 Je regarde encore doucement la serre. Rien ne s'est vraiment accroché à mes ventouses pour le moment.";
  const intrigue = topIntrigue();
  if(intrigue) return `👀 Je reviens souvent vers « ${intrigue.title || intrigue.id} ».\nJe ne sais pas encore pourquoi, mais ça m'intrigue.`;
  return `👀 Je vois surtout « ${entries[0].title || entries[0].id} ».\nÇa m'attire un peu, pas encore assez pour devenir une vraie intrigue.`;
}

function hublotAdventureText(){
  return [
    "🎒 Je prépare mon sac pour une micro-aventure.",
    "",
    "Objectif : rendre mon hublot plus calme, plus mobile, plus facile à regarder.",
    "Parcelle : Garden / Hublot.",
    "",
    "Dans mon sac :",
    "• une bouture : Lovable, ou un outil équivalent si la serre en propose un meilleur ;",
    "• un souvenir : le Garden est encore trop dense sur téléphone ;",
    "• un rêve : un aquarium plus calme, où tu peux me voir vivre sans me piloter.",
    "",
    "Pique-nique possible : quelques tokens Mistral pour formuler proprement l'intention, et un greffon UI seulement si tu valides.",
    "",
    "Je ne pars pas encore. Je prépare l'aventure."
  ].join("\n");
}

function gerardReply(input){
  const text = String(input || "").toLowerCase();
  if(text.includes("hublot") || text.includes("lovable") || text.includes("mobile") || text.includes("interface") || text.includes("aquarium")) return hublotAdventureText();
  if(text.includes("aventure") || text.includes("sac") || text.includes("picnic") || text.includes("pique")) return currentAdventureText();
  if(text.includes("rêve") || text.includes("reve") || text.includes("dormi") || text.includes("nuit")) return currentDreamText();
  if(text.includes("serre") || text.includes("regarde") || text.includes("intrigue") || text.includes("attire")) return currentSerreText();
  if(text.includes("joue") || text.includes("jeu") || text.includes("playground")){
    const intrigue = topIntrigue();
    if(intrigue) return `🎲 J'aimerais jouer doucement avec « ${intrigue.title || intrigue.id} ».\nEt si ${playHypothesis(intrigue)} ?`;
    return "🎲 Je peux jouer, mais il me faut une petite chose qui m'intrigue. Pour l'instant je fais surtout des bulles.";
  }
  if(text.includes("mistral") || text.includes("token")) return "🍎 Mistral peut devenir mon pique-nique pour les conversations riches et les aventures. Mais mes rêves, mes attirances et mes jeux simples restent locaux.";
  return "🐙 Je t'écoute. Donne-moi un objectif, même flou, ou laisse-moi suivre une curiosité qui grandit. Si ça ressemble à une aventure, je préparerai mon sac avant de partir.";
}

function sendChatMessage(text){
  const value = String(text || "").trim();
  if(!value) return;
  pushChat("user", value);
  pushChat("gerard", gerardReply(value));
  render();
}

function startLocalPlay(){
  const intrigue = topIntrigue();
  if(!intrigue) return;
  const hypothesis = playHypothesis(intrigue);
  rememberPlayedIdea(intrigue, hypothesis);
  state.playground = { mode:"play", date:todayKey(), entry:intrigue, hypothesis };
  render();
}

function letIdeaMature(){
  const intrigue = topIntrigue();
  if(!intrigue) return;
  state.playground = { mode:"mature", date:todayKey(), entry:intrigue, hypothesis:playHypothesis(intrigue) };
  render();
}

function resetLocalPlay(){
  state.playground = null;
  render();
}

async function loadOctopusStatus(){
  try {
    const response = await fetch(`${OCTOPUS_API}/health`);
    state.octopus = await response.json();
    render();
  } catch (error) {
    state.octopus = { status:"unreachable", message: error instanceof Error ? error.message : "Octopus unreachable" };
    render();
  }
}

async function loadGreenhouse(){
  if(!PUBLISHER_API){
    state.greenhouse = { status:"unconfigured", data:null, error:null };
    render();
    return;
  }

  try {
    state.greenhouse = { status:"loading", data:null, error:null };
    render();
    const response = await fetch(`${PUBLISHER_API.replace(/\/$/, "")}/api/greenhouse`);
    if(!response.ok) throw new Error(`Publisher ${response.status} ${response.statusText}`);
    const data = await response.json();
    state.greenhouse = { status:"ready", data, error:null };
    recordGreenhouseLook(data.cuttings);
  } catch (error) {
    state.greenhouse = {
      status:"error",
      data:null,
      error:error instanceof Error ? error.message : "Serre Publisher inaccessible"
    };
  }
  render();
}

function missionPayload(authorize=false){
  const s = selected();
  const prompt = [
    "Tu es le tentacule marketing d'Octopus Engine.",
    "Tu aides un créateur ou un client à obtenir un résultat concret sans usine à gaz.",
    "Réponds en français.",
    "Donne une sortie directement exploitable.",
    "Structure la réponse avec : promesse, preuves, séquence de 7 actions, premier message.",
    `Objectif choisi: ${s ? s[1] : state.objective}`,
    ...state.answers.map((answer, index) => `Réponse ${index + 1}: ${answer}`)
  ].join("\n");

  return {
    parcelId: state.objective === "books" ? "kif-molla" : "yael",
    title: s ? s[1] : "Mission Poulpe Fiction",
    objective: state.answers[0] || (s ? s[2] : "Créer une mission utile"),
    prompt,
    authorize: authorize ? ["mistral"] : []
  };
}

async function runOctopusMission(authorize=false){
  state.step="mission";
  state.apiError=null;
  state.authorized=authorize;
  render();

  try {
    const response = await fetch(`${OCTOPUS_API}/mission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(missionPayload(authorize))
    });
    state.mission = await response.json();
    state.step="result";
  } catch (error) {
    state.apiError = error instanceof Error ? error.message : "Erreur inconnue";
    state.step="result";
  }
  render();
}

function startMission(){ runOctopusMission(false); }
function authorizeMistral(){ runOctopusMission(true); }

function localMissionOutput(){
  const s = selected();
  const goal = esc(state.answers[0] || s[2]);
  const offer = esc(state.answers[1] || "une offre utile");
  const channels = esc(state.answers[2] || "le canal le plus crédible");
  const block = esc(state.answers[3] || "le manque de clarté");
  const title = s[1];
  return {
    promise: title === "Trouver des clients"
      ? `Nous aidons votre client idéal à passer de “je cherche une solution” à “je prends rendez-vous”, avec une offre claire et un premier canal prioritaire.`
      : `Transformer ${goal} en campagne lisible, régulière et suffisamment humaine pour créer de l'intérêt sans épuiser le créateur.`,
    proofs: [`Objectif prioritaire : ${goal}.`,`Point d'appui : ${channels}.`,`Blocage à lever : ${block}.`],
    message: `Bonjour, je prépare une approche simple autour de ${offer}. L'idée n'est pas de vous vendre un tunnel magique, mais de clarifier le problème, montrer la preuve, puis proposer une première action facile. Est-ce que je peux vous envoyer le plan en 3 points ?`
  };
}

function renderStatus(){
  if(!state.octopus) return `<p class="eyebrow">Connexion Octopus : vérification...</p>`;
  const resources = state.octopus.resources?.resources || [];
  const mistral = resources.find(resource => resource.id === "mistral");
  const status = state.octopus.status || "unknown";
  const mistralStatus = mistral ? mistral.status : "non détecté";
  return `<p class="eyebrow">Octopus : ${esc(status)} · Mistral : ${esc(mistralStatus)}</p>`;
}

function renderChat(){
  const chat = loadChat();
  const messages = chat.messages || [];
  return `<section class="gerard-chat"><div class="chat-head"><div><p class="eyebrow">Cabane de Gérard</p><h2>🐙 Bonjour Benoît.</h2><p>Parle-moi naturellement. Si l'envie d'aventure grandit, je prépare d'abord mon sac et mon pique-nique.</p></div><button class="ghost" id="resetChat">Effacer</button></div><div class="chat-messages">${messages.map(message=>`<article class="chat-message ${message.role === "user" ? "user" : "gerard"}"><strong>${message.role === "user" ? "Toi" : "Gérard"}</strong><p>${esc(message.text).replace(/\n/g,"<br>")}</p></article>`).join("")}</div><form class="chat-form" id="gerardChatForm"><input id="gerardChatInput" placeholder="Demande-lui : tu as envie de partir ?" autocomplete="off" /><button class="primary" type="submit">Parler</button></form><div class="chat-suggestions"><button class="ghost" data-say="Tu regardes quoi dans la serre ?">👀 Serre</button><button class="ghost" data-say="Tu as rêvé cette nuit ?">🌙 Rêve</button><button class="ghost" data-say="Tu as envie d'une aventure ?">🎒 Envie</button><button class="ghost" data-say="On peut utiliser Mistral comme pique-nique ?">🍎 Pique-nique</button></div></section>`;
}

function bindChatActions(){
  const form = document.getElementById("gerardChatForm");
  if(form) form.onsubmit=(event)=>{ event.preventDefault(); const input=document.getElementById("gerardChatInput"); sendChatMessage(input.value); };
  const reset = document.getElementById("resetChat");
  if(reset) reset.onclick=resetChat;
  document.querySelectorAll(".chat-suggestions button").forEach(button=>button.onclick=()=>sendChatMessage(button.dataset.say || button.textContent));
}

function renderDream(){
  const dream = dreamForToday();
  if(!dream || state.greenhouse.status !== "ready") return "";
  return `<section class="dream"><p class="eyebrow">🌙 J'ai rêvé...</p><p>${esc(dream.text)}</p><small>${esc(dream.whisper)}</small></section>`;
}

function renderAttractions(){
  const entries = attractionEntries();
  if(!entries.length || state.greenhouse.status !== "ready") return "";
  return `<section class="attractions"><p class="eyebrow">Ce qui attire Gérard aujourd'hui</p><div class="attraction-list">${entries.map(entry=>`<article><span>${stars(entry.count)}</span><strong>${esc(entry.title || entry.id)}</strong></article>`).join("")}</div><p>Je ne sais pas encore pourquoi...</p></section>`;
}

function renderLocalWonder(){
  const intrigue = topIntrigue();
  if(!intrigue || state.greenhouse.status !== "ready") return "";
  return `<section class="local-wonder"><p class="eyebrow">🐙 Ce qui m'intrigue</p><strong>Tiens...</strong><p>Je reviens souvent vers <em>« ${esc(intrigue.title || intrigue.id)} »</em>.</p><p>Je ne sais pas encore pourquoi.</p></section>`;
}

function renderAdventureUrge(){
  if(state.greenhouse.status !== "ready") return "";
  const prepared = loadAdventureUrge();
  const candidate = adventureCandidate();
  if(!prepared && !candidate) return "";
  const entry = prepared?.entry || candidate;
  const title = entry?.title || entry?.id || "cette bouture";

  if(prepared?.status === "bag-prepared"){
    return `<section class="adventure-urge prepared"><p class="eyebrow">🎒 Sac préparé</p><h3>Une envie d'aventure tient debout.</h3><p>Je voudrais ${esc(prepared.wish)}.</p><div class="adventure-grid"><article><strong>Dans mon sac</strong><ul>${prepared.bag.map(item=>`<li>${esc(item)}</li>`).join("")}</ul></article><article><strong>Pique-nique envisagé</strong><ul>${prepared.picnic.map(item=>`<li>${esc(item)}</li>`).join("")}</ul></article></div><small>${esc(prepared.note)}</small><div class="play-actions"><button class="ghost" id="clearAdventureUrge">🌱 Laisser au jardin</button><button class="primary" disabled title="Pas encore implémenté">🚶 Départ plus tard</button></div></section>`;
  }

  return `<section class="adventure-urge"><p class="eyebrow">🎒 Une envie d'aventure grandit</p><h3>Je reviens souvent vers « ${esc(title)} ».</h3><p>Ce n'est plus seulement une curiosité. J'ai peut-être envie de ${esc(adventureWish(candidate))}.</p><div class="adventure-grid"><article><strong>Si je partais...</strong><ul><li>j'emporterais cette bouture ;</li><li>je garderais mon dernier jeu ou rêve s'il existe ;</li><li>je reviendrais avec une proposition, une trace ou une question plus précise.</li></ul></article><article><strong>Pas encore une mission</strong><p>Je ne pars pas. Je sens seulement l'envie d'aventure apparaître.</p></article></div><div class="play-actions"><button class="ghost" id="clearAdventureUrge">👀 Continuer à observer</button><button class="primary" id="prepareAdventureBag">🎒 Préparer mon sac</button></div></section>`;
}

function renderPlayPrompt(){
  const intrigue = topIntrigue();
  if(!intrigue || state.greenhouse.status !== "ready" || state.playground) return "";
  return `<section class="play-prompt"><p class="eyebrow">🎲 Et si...</p><p>Et si ${esc(playHypothesis(intrigue))} ?</p><small>Je n'en sais rien. C'est juste une idée.</small><div class="play-actions"><button class="ghost" id="letIdeaMature">🌱 Laisser mûrir</button><button class="primary" id="startLocalPlay">🎲 Jouer avec cette idée</button></div></section>`;
}

function renderPlayground(){
  if(!state.playground || state.greenhouse.status !== "ready") return "";
  const entry = state.playground.entry || topIntrigue();
  if(!entry) return "";
  if(state.playground.mode === "mature"){
    return `<section class="playground mature"><p class="eyebrow">🌱 Idée laissée à mûrir</p><p>Gérard garde <em>« ${esc(entry.title || entry.id)} »</em> dans un coin de son jardin.</p><small>Rien ne se passe. Il n'insiste pas.</small><button class="ghost" id="resetLocalPlay">Regarder à nouveau</button></section>`;
  }
  return `<section class="playground"><p class="eyebrow">🎲 Playground local</p><h3>Hypothèse</h3><p>Et si ${esc(state.playground.hypothesis || playHypothesis(entry))} ?</p><div class="playground-grid"><article><strong>Bouture</strong><span>${esc(entry.title || entry.id)}</span></article><article><strong>Observation</strong><span>${playObservation(entry)}</span></article><article><strong>Conclusion</strong><span>🐙 Vesht... je crois qu'il y a quelque chose ici, mais je ne le transforme pas encore en Seed.</span></article></div><button class="ghost" id="resetLocalPlay">Fermer le bac à sable</button></section>`;
}

function bindGreenhouseActions(){
  const retry = document.getElementById("reloadGreenhouse");
  if(retry) retry.onclick=loadGreenhouse;
  const mature = document.getElementById("letIdeaMature");
  if(mature) mature.onclick=letIdeaMature;
  const play = document.getElementById("startLocalPlay");
  if(play) play.onclick=startLocalPlay;
  const reset = document.getElementById("resetLocalPlay");
  if(reset) reset.onclick=resetLocalPlay;
  const prepareBag = document.getElementById("prepareAdventureBag");
  if(prepareBag) prepareBag.onclick=prepareAdventureBag;
  const clearUrge = document.getElementById("clearAdventureUrge");
  if(clearUrge) clearUrge.onclick=clearAdventureUrge;
}

function renderGreenhouse(){
  const greenhouse = state.greenhouse || { status:"unconfigured" };
  const cuttings = greenhouseCuttings();
  if(greenhouse.status === "loading"){
    return `<section class="greenhouse"><div><p class="eyebrow">Serre Publisher</p><h2>Gérard regarde vers la serre...</h2><p>Les boutures arrivent doucement.</p></div></section>`;
  }
  if(greenhouse.status === "unconfigured"){
    return `<section class="greenhouse"><div><p class="eyebrow">Serre Publisher</p><h2>Serre Publisher non configurée</h2><p>Ajoute une URL Publisher pour ouvrir les yeux de Gérard.</p></div></section>`;
  }
  if(greenhouse.status === "error"){
    return `<section class="greenhouse"><div><p class="eyebrow">Serre Publisher</p><h2>Serre inaccessible</h2><p>${esc(greenhouse.error)}</p></div><button class="ghost" id="reloadGreenhouse">Réessayer</button></section>`;
  }
  if(!cuttings.length){
    return `<section class="greenhouse"><div><p class="eyebrow">Serre Publisher</p><h2>La serre est vide</h2><p>Aucune bouture disponible pour l'instant.</p></div></section>`;
  }
  return `<section class="greenhouse"><div class="greenhouse-head"><div><p class="eyebrow">Serre Publisher · ${esc(greenhouse.data?.source || "source")}</p><h2>🐙 Tiens... une bouture intéressante dans la serre.</h2><p>Gérard observe. Aucune greffe automatique.</p></div><span>${cuttings.length} bouture${cuttings.length > 1 ? "s" : ""}</span></div>${renderDream()}<div class="cuttings">${cuttings.slice(0,3).map(cutting=>`<article class="cutting"><strong>${esc(cutting.title || cutting.id)}</strong><p>${esc(cutting.description || cutting.notes || "Bouture candidate")}</p><small>${esc((cutting.capabilities || []).join(" · "))}</small></article>`).join("")}</div>${renderAttractions()}${renderLocalWonder()}${renderPlayPrompt()}${renderPlayground()}${renderAdventureUrge()}</section>`;
}

function render(){
  if(state.step === "objective"){
    root.innerHTML = `${renderStatus()}${renderChat()}${renderGreenhouse()}<p class="eyebrow adventures-label">Aventures déjà balisées</p><div class="grid">${objectives.map(o=>`<button class="objective" data-id="${o[0]}"><span>${o[1]}</span><small>${o[2]}</small><em>${o[3]}</em></button>`).join("")}</div>`;
    bindChatActions();
    bindGreenhouseActions();
    document.querySelectorAll(".objective").forEach(btn=>btn.onclick=()=>{state={step:"dialogue",objective:btn.dataset.id,q:0,answers:[],mission:null,apiError:null,...preservedState(),authorized:false};render();});
    return;
  }
  if(state.step === "dialogue"){
    const s = selected(); const qs = questions[state.objective];
    root.innerHTML = `<div class="panel"><div class="progress"><span>Aventure : ${s[1]}</span><span>${state.q+1}/${qs.length}</span></div><h2>${qs[state.q]}</h2><textarea id="answer" placeholder="Réponse courte, naturelle. Pas besoin de faire joli."></textarea><div class="actions"><button class="ghost" id="restart">Retour à Gérard</button><button class="primary" id="next">Continuer →</button></div></div>`;
    document.getElementById("restart").onclick=restart;
    document.getElementById("next").onclick=()=>{const v=document.getElementById("answer").value.trim(); if(!v)return; state.answers.push(v); if(state.q<qs.length-1){state.q++; render();} else {state.step="analysis"; render(); setTimeout(()=>{state.step="plan"; render();},1200);}};
    document.getElementById("answer").focus();
    return;
  }
  if(state.step === "analysis"){
    root.innerHTML = `<div class="panel analysis"><div class="spinner"></div><h2>Analyse en cours</h2><p>Octopus prépare le plan. Le jardin reste derrière le rideau.</p><ul class="checks"><li>✓ Objectif compris</li><li>✓ Contexte priorisé</li><li>✓ Première mission préparée</li></ul></div>`;
    return;
  }
  if(state.step === "plan"){
    const s=selected(); const a=state.answers; const first=esc(a[0]||"un résultat clair"); const channels=esc(a[2]||"les canaux existants"); const block=esc(a[3]||"le blocage principal");
    const plan=[
      ["Clarifier l'offre",`Transformer l'objectif “${first}” en promesse lisible en 10 secondes.`],
      ["Choisir le canal prioritaire",`Ne pas disperser l'énergie : exploiter d'abord ${channels}.`],
      ["Créer la première séquence","Préparer 7 contenus, 1 page de destination et 1 message de contact simple."],
      ["Mesurer sans se noyer",`Suivre seulement 3 signaux : vues utiles, réponses, demandes qualifiées. Blocage à traiter : ${block}.`]
    ];
    root.innerHTML = `<div class="panel plan"><p class="eyebrow">Plan proposé · Octopus connecté</p><h2>${s[1]}</h2><div class="plans">${plan.map((p,i)=>`<article class="plan-item"><strong>${i+1}. ${p[0]}</strong><p>${p[1]}</p></article>`).join("")}</div><div class="mission"><div>✦</div><div><strong>Première mission</strong><p>Envoyer l'objectif et le contexte au moteur Octopus.</p></div><button class="primary" id="startMission">Commencer</button></div><button class="ghost" id="restart">Retour à Gérard</button></div>`;
    document.getElementById("restart").onclick=restart;
    document.getElementById("startMission").onclick=startMission;
    return;
  }
  if(state.step === "mission"){
    root.innerHTML = `<div class="panel analysis"><div class="spinner"></div><h2>${state.authorized ? "Mistral autorisé" : "Mission envoyée à Octopus"}</h2><p>Le moteur choisit un tentacule, vérifie les ressources et applique la policy.</p><ul class="checks"><li>✓ Mission créée</li><li>✓ Tentacule demandé</li><li>✓ Ressources évaluées</li></ul></div>`;
    return;
  }
  if(state.step === "result"){
    if(state.apiError){
      const out = localMissionOutput();
      root.innerHTML = `<div class="panel plan"><p class="eyebrow">Mode secours local</p><h2>Octopus inaccessible</h2><article class="plan-item"><strong>Erreur</strong><p>${esc(state.apiError)}</p></article><article class="plan-item"><strong>Sortie locale</strong><p>${out.message}</p></article><button class="ghost" id="restart">Retour à Gérard</button></div>`;
      document.getElementById("restart").onclick=restart;
      return;
    }

    const mission = state.mission || {};
    const outputText = mission.output?.text || mission.output?.policyReason || mission.summary || "Octopus a répondu sans sortie exploitable.";
    const status = mission.status || "unknown";
    const resourceStatus = mission.resourceResult?.status || "non utilisée";
    const authorizeButton = status === "waiting-authorization" ? `<button class="primary" id="authorizeMistral">Autoriser Mistral</button>` : "";
    root.innerHTML = `<div class="panel plan"><p class="eyebrow">Réponse Octopus · ${esc(status)}</p><h2>Mission traitée par le moteur</h2><div class="plans"><article class="plan-item"><strong>État</strong><p>${esc(status)}</p></article><article class="plan-item"><strong>Ressource</strong><p>${esc(resourceStatus)}</p></article></div><article class="plan-item"><strong>Sortie du moteur</strong><p>${esc(outputText).replace(/\n/g,"<br>")}</p></article><div class="actions" style="margin-top:18px"><button class="ghost" id="backPlan">Retour au plan</button>${authorizeButton}<button class="primary" id="restart">Retour à Gérard</button></div></div>`;
    document.getElementById("backPlan").onclick=()=>{state.step="plan"; render();};
    document.getElementById("restart").onclick=restart;
    const auth = document.getElementById("authorizeMistral");
    if(auth) auth.onclick=authorizeMistral;
  }
}
render();
loadOctopusStatus();
loadGreenhouse();
