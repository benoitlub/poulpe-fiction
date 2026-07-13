(function productionPlanModule(global) {
  "use strict";

  const STORE_KEY = "poulpe-fiction:production-plans:v1";
  const TEMPLATES = {
    book: [
      { id:"landing-page", type:"landing-page", label:"Landing page", role:"web", providers:["Poulpe Fiction HTML"], dependsOn:[] },
      { id:"social-visual", type:"social-visual", label:"Visuel Instagram", role:"visual", providers:["Canva","image-generator"], dependsOn:["landing-page"] },
      { id:"voice-over", type:"voice-over", label:"Voix off", role:"voice", providers:["ElevenLabs"], dependsOn:["landing-page"] },
      { id:"vertical-video", type:"vertical-video", label:"Vidéo verticale 9:16", role:"video", providers:["Kling","Runway"], dependsOn:["social-visual","voice-over"] },
      { id:"instagram-publication", type:"publication", label:"Publication Instagram", role:"publish", providers:["Metricool"], dependsOn:["social-visual","vertical-video"] },
      { id:"tiktok-publication", type:"publication", label:"Publication TikTok", role:"publish", providers:["Metricool"], dependsOn:["vertical-video"] }
    ],
    game: [
      { id:"product-page", type:"landing-page", label:"Fiche produit", role:"web", providers:["Poulpe Fiction HTML"], dependsOn:[] },
      { id:"demo-visual", type:"social-visual", label:"Visuel de démonstration", role:"visual", providers:["Canva","image-generator"], dependsOn:["product-page"] },
      { id:"demo-video", type:"vertical-video", label:"Vidéo de démonstration", role:"video", providers:["Kling","Runway"], dependsOn:["demo-visual"] },
      { id:"prospect-pack", type:"prospect-pack", label:"Pack partenaires/prospects", role:"business", providers:["Publisher business-growth"], dependsOn:["product-page"] },
      { id:"outreach-draft", type:"email-draft", label:"Premier message de contact", role:"business", providers:["Publisher"], dependsOn:["prospect-pack"] }
    ],
    app: [
      { id:"landing-page", type:"landing-page", label:"Landing page", role:"web", providers:["Poulpe Fiction HTML"], dependsOn:[] },
      { id:"demo-visual", type:"social-visual", label:"Visuel produit", role:"visual", providers:["Canva","image-generator"], dependsOn:["landing-page"] },
      { id:"demo-video", type:"vertical-video", label:"Démonstration verticale", role:"video", providers:["Kling","Runway"], dependsOn:["demo-visual"] },
      { id:"beta-publication", type:"publication", label:"Appel à bêta-testeurs", role:"publish", providers:["Metricool"], dependsOn:["landing-page","demo-video"] }
    ],
    page: [
      { id:"page-content", type:"landing-page", label:"Page publiable", role:"web", providers:["Poulpe Fiction HTML"], dependsOn:[] },
      { id:"hero-visual", type:"social-visual", label:"Visuel principal", role:"visual", providers:["Canva","image-generator"], dependsOn:["page-content"] },
      { id:"launch-publication", type:"publication", label:"Publication de lancement", role:"publish", providers:["Metricool"], dependsOn:["page-content","hero-visual"] }
    ]
  };

  function nowIso(){ return new Date().toISOString(); }
  function esc(value){ return String(value||"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
  function load(){ try{ const v=JSON.parse(localStorage.getItem(STORE_KEY)||"[]"); return Array.isArray(v)?v:[]; }catch(_){ return []; } }
  function save(plan){ const previous=load().filter((item)=>item.id!==plan.id&&item.seedId!==plan.seedId); localStorage.setItem(STORE_KEY,JSON.stringify([plan,...previous].slice(0,50))); return plan; }
  function activeSeedDefinition(){ const context=global.BlacklaceParcel?.activeSeed?.(); const seeds=global.BlacklaceParcel?.parcel?.seeds||[]; return context?seeds.find((seed)=>seed.id===context.seedId)||{...context,type:"page"}:null; }
  function isInternalProvider(provider){ return /^poulpe fiction html$/i.test(String(provider||"").trim()); }

  function chooseProvider(step,tools){
    const candidates=Array.isArray(tools)?tools:[];
    const match=candidates.find((tool)=>{ const text=`${tool.id||""} ${tool.name||""} ${tool.role||""} ${(tool.capabilities||[]).join(" ")}`.toLowerCase(); return step.providers.some((provider)=>text.includes(provider.toLowerCase()))||text.includes(step.role); });
    return match?.name||match?.id||step.providers[0];
  }

  function create(seed,toolPack){
    if(!seed) return null;
    const template=TEMPLATES[seed.type]||TEMPLATES.page;
    const tools=toolPack?.tools||[];
    const steps=template.map((step)=>{ const provider=chooseProvider(step,tools); const internal=isInternalProvider(provider); return { ...step, provider, providerStatus:internal?"available":"unresolved", connectionRoute:internal?"internal":"manual", authorization:internal?"granted":"required", creditStatus:internal?"not-applicable":"unknown", executable:internal, status:step.dependsOn.length?"blocked":"ready-to-produce" }; });
    return save({ version:4,id:`production-plan-${seed.id}`,parcelId:global.BlacklaceParcel?.PARCEL_ID||"blacklace-ecosystem",seedId:seed.id,seedTitle:seed.title,goal:seed.objective,expectedHarvest:seed.firstHarvest,createdAt:nowIso(),updatedAt:nowIso(),toolPackSource:toolPack?.source||"template-fallback",brokerStatus:"not-checked",status:"planned",steps });
  }

  function current(){ const seed=activeSeedDefinition(); if(!seed) return null; return load().find((plan)=>plan.seedId===seed.id)||create(seed,null); }

  async function refreshFromPublisher(){
    const seed=activeSeedDefinition(); if(!seed) return null;
    let toolPack=null;
    try{ if(global.BlacklaceParcel?.loadToolPack) toolPack=await global.BlacklaceParcel.loadToolPack(seed); }catch(error){ console.warn("Publisher tool pack unavailable",error); }
    const plan=create(seed,toolPack);
    if(global.ConnectionBroker?.planAll){
      const externalSteps=plan.steps.filter((step)=>!isInternalProvider(step.provider));
      const decisions=await global.ConnectionBroker.planAll(seed.id,externalSteps);
      let decisionIndex=0;
      plan.steps=plan.steps.map((step)=>{
        if(isInternalProvider(step.provider)) return { ...step, providerStatus:"available", connectionRoute:"internal", authorization:"granted", creditStatus:"not-applicable", executable:true, status:step.dependsOn.length?"blocked":"ready-to-produce" };
        const decision=decisions[decisionIndex++]||null; const selected=decision?.selected||null;
        return { ...step, provider:selected?.name||step.provider, providerStatus:selected?.connectionStatus||"not-configured", connectionRoute:selected?.route||"manual", authorization:selected?.authorization||"required", creditStatus:selected?.creditStatus||"unknown", freeTier:selected?.freeTier||null, trial:selected?.trial||null, fallbackProviders:(decision?.alternatives||[]).map((item)=>item.name), brokerDecisionMode:decision?.decisionMode||"unavailable", executable:Boolean(decision?.executable), status:step.dependsOn.length?"blocked":decision?.executable?"ready-to-produce":"waiting-adapter" };
      });
      const external = plan.steps.filter((step)=>!isInternalProvider(step.provider));
      const executableCount = external.filter((step)=>step.executable).length;
      plan.brokerStatus = external.length === 0 ? "no-external-step" : executableCount === external.length ? "routes-confirmed" : executableCount > 0 ? "partially-connected" : "connections-required";
      plan.updatedAt=nowIso(); save(plan);
    }
    if(typeof global.render==="function") global.render();
    return plan;
  }

  function updateFromProductionPack(pack){
    if(!pack) return null;
    const plan=load().find((item)=>item.seedId===pack.seedId)||current(); if(!plan) return null;
    const states=new Map([...(pack.artifacts||[]).map((item)=>[item.id,item.status]),...(pack.publications||[]).map((item)=>[item.id,item.status])]);
    const completed=new Set([...states].filter(([,status])=>status==="ready"||status==="published").map(([id])=>id));
    plan.steps=plan.steps.map((step)=>{
      const producedStatus=states.get(step.id);
      if(producedStatus==="ready"||producedStatus==="published") return { ...step, status:producedStatus, providerStatus:isInternalProvider(step.provider)?"confirmed":step.providerStatus, connectionRoute:isInternalProvider(step.provider)?"internal":step.connectionRoute, authorization:isInternalProvider(step.provider)?"granted":step.authorization, creditStatus:isInternalProvider(step.provider)?"not-applicable":step.creditStatus, executable:isInternalProvider(step.provider)||step.executable };
      const dependenciesReady=(step.dependsOn||[]).every((id)=>completed.has(id));
      if(!dependenciesReady) return { ...step, status:"blocked" };
      return { ...step, status:step.executable?"ready-to-produce":"waiting-adapter" };
    });
    plan.status=plan.steps.every((step)=>step.status==="ready"||step.status==="published")?"complete":"in-progress";
    plan.updatedAt=nowIso(); return save(plan);
  }

  function statusLabel(status){ return ({"ready-to-produce":"Prêt à produire",planned:"À préparer",ready:"Produit confirmé",producing:"En cours",blocked:"En attente","waiting-adapter":"Connexion requise",published:"Publié confirmé"})[status]||status; }
  function brokerLabel(status){ return ({"not-checked":"Connexions non vérifiées","routes-confirmed":"Routes confirmées","partially-connected":"Partiellement connecté","connections-required":"Connexions requises","no-external-step":"Aucune connexion externe"})[status]||status; }
  function render(plan){
    if(!plan) return "";
    const broker=global.ConnectionBroker;
    const rows=plan.steps.map((step,index)=>{
      const dependencies=step.dependsOn.length?`Après : ${step.dependsOn.join(", ")}`:"Point de départ";
      const connection=step.connectionRoute==="internal"?(step.status==="ready"?"✅ Résultat confirmé":"Producteur disponible"):broker?.connectionLabel?.(step.providerStatus)||step.providerStatus||"non résolu";
      const route=step.connectionRoute==="internal"?"Poulpe Fiction":broker?.routeLabel?.(step.connectionRoute)||step.connectionRoute||"route inconnue";
      const credits=step.creditStatus==="not-applicable"?"aucun crédit requis":broker?.creditLabel?.(step.creditStatus)||step.creditStatus||"crédits inconnus";
      const fallbacks=step.fallbackProviders?.length?`Alternatives : ${step.fallbackProviders.join(", ")}`:isInternalProvider(step.provider)?"Aucun résultat tant que la production n’a pas été lancée":"Aucune alternative mémorisée";
      const free=step.freeTier?.available?" · palier gratuit observé":"";
      return `<article class="production-item"><div><span class="production-status">${statusLabel(step.status)}</span><h3>${index+1}. ${esc(step.label)}</h3><p><strong>${esc(step.provider)}</strong> · ${esc(connection)} · ${esc(route)}</p><small>${esc(credits)}${free} · ${esc(dependencies)}<br>${esc(fallbacks)}</small></div><small>${esc(step.type)}</small></article>`;
    }).join("");
    const refresh=`<button class="ghost" data-refresh-production-plan>🔎 Vérifier les connexions</button>`;
    return `<section class="production-plan"><p class="eyebrow">🧭 Plan de production · Connection Broker</p><div class="production-head"><div><h2>${esc(plan.seedTitle)}</h2><p>${esc(plan.goal)}</p></div><span>${esc(brokerLabel(plan.brokerStatus||plan.status))}</span></div><div class="production-sources"><strong>Récolte visée</strong><p>${esc(plan.expectedHarvest)}</p>${refresh}</div><div class="production-grid">${rows}</div><small>Une route n’est marquée confirmée que si Publisher et le serveur reconnaissent réellement la connexion.</small></section>`;
  }

  function bind(){ document.querySelectorAll("[data-refresh-production-plan]").forEach((button)=>{ button.onclick=()=>{ button.disabled=true; button.textContent="Vérification…"; void refreshFromPublisher(); }; }); }

  global.ProductionPlan={STORE_KEY,load,save,create,current,refreshFromPublisher,updateFromProductionPack,render,bind,isInternalProvider};
  const baseRenderAdventure=global.renderAdventureUrge;
  if(typeof baseRenderAdventure==="function") global.renderAdventureUrge=function(){ const html=baseRenderAdventure(); const plan=current(); setTimeout(bind,0); return plan?`${html}${render(plan)}`:html; };
})(globalThis);
