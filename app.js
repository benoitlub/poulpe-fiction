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

let state = { step:"objective", objective:null, q:0, answers:[] };
const root = document.getElementById("root");

function selected(){ return objectives.find(o=>o[0]===state.objective); }
function esc(s){ return String(s || "").replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c])); }
function restart(){ state={step:"objective",objective:null,q:0,answers:[]}; render(); }

function render(){
  if(state.step === "objective"){
    root.innerHTML = `<div class="grid">${objectives.map(o=>`<button class="objective" data-id="${o[0]}"><span>${o[1]}</span><small>${o[2]}</small><em>${o[3]}</em></button>`).join("")}</div>`;
    document.querySelectorAll(".objective").forEach(btn=>btn.onclick=()=>{state={step:"dialogue",objective:btn.dataset.id,q:0,answers:[]};render();});
    return;
  }
  if(state.step === "dialogue"){
    const s = selected(); const qs = questions[state.objective];
    root.innerHTML = `<div class="panel"><div class="progress"><span>Objectif : ${s[1]}</span><span>${state.q+1}/${qs.length}</span></div><h2>${qs[state.q]}</h2><textarea id="answer" placeholder="Réponse courte, naturelle. Pas besoin de faire joli."></textarea><div class="actions"><button class="ghost" id="restart">Changer d'objectif</button><button class="primary" id="next">Continuer →</button></div></div>`;
    document.getElementById("restart").onclick=restart;
    document.getElementById("next").onclick=()=>{const v=document.getElementById("answer").value.trim(); if(!v)return; state.answers.push(v); if(state.q<qs.length-1){state.q++; render();} else {state.step="analysis"; render(); setTimeout(()=>{state.step="plan"; render();},1200);}};
    document.getElementById("answer").focus();
    return;
  }
  if(state.step === "analysis"){
    root.innerHTML = `<div class="panel analysis"><div class="spinner"></div><h2>Analyse en cours</h2><p>Le moteur prépare le plan. Le jardin reste derrière le rideau.</p><ul class="checks"><li>✓ Objectif compris</li><li>✓ Contexte priorisé</li><li>✓ Première mission préparée</li></ul></div>`;
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
    root.innerHTML = `<div class="panel plan"><p class="eyebrow">Plan proposé</p><h2>${s[1]}</h2><div class="plans">${plan.map((p,i)=>`<article class="plan-item"><strong>${i+1}. ${p[0]}</strong><p>${p[1]}</p></article>`).join("")}</div><div class="mission"><div>✦</div><div><strong>Première mission</strong><p>Rédiger la promesse, les 3 preuves et le premier message de campagne.</p></div><button class="primary">Commencer</button></div><button class="ghost" id="restart">Nouvel objectif</button></div>`;
    document.getElementById("restart").onclick=restart;
  }
}
render();
