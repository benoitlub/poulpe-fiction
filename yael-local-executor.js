(function yaelLocalExecutorModule(global) {
  "use strict";

  const YAEL_SEED_ID = "yael-prospection";
  const YAEL_PARCEL_ID = "project-yael-prospection";
  const COMPLETE_MARKER = "<!-- HARVEST_COMPLETE -->";
  const COMPLETED_KEY = "poulpe-fiction:yael-local-harvest:v1";

  function alreadyCompleted() {
    try { return localStorage.getItem(COMPLETED_KEY) === "done"; }
    catch (_) { return false; }
  }

  function markCompleted() {
    try { localStorage.setItem(COMPLETED_KEY, "done"); } catch (_) {}
  }

  function buildKit() {
    return `# Kit de préqualification commerciale — Yael

## 1. Prospect idéal à confirmer

Le prospect prioritaire est une personne ou une organisation ayant un besoin identifiable, actuel ou proche, compatible avec l’offre de Yael, disposant d’un interlocuteur joignable et montrant au moins un signal concret d’intérêt, de changement ou de décision à venir.

Cette définition reste une hypothèse de travail. Elle doit être affinée avec Yael à partir de ses clients réels, de sa zone géographique, de son offre exacte et de ses critères d’exclusion.

## 2. Grille de qualification — score sur 100

| Critère | Question de vérification | Score maximum |
|---|---|---:|
| Adéquation avec l’offre | Le besoin entre-t-il clairement dans le périmètre de Yael ? | 20 |
| Besoin identifiable | Un problème, projet ou changement concret est-il visible ? | 15 |
| Temporalité | Le besoin paraît-il actuel ou prévu dans les 6 prochains mois ? | 15 |
| Pouvoir de décision | L’interlocuteur peut-il décider ou orienter vers le décideur ? | 15 |
| Accessibilité | Existe-t-il un moyen de contact professionnel vérifiable ? | 10 |
| Signal d’intention | Le prospect a-t-il publié, demandé, recruté, déménagé, investi ou changé récemment ? | 10 |
| Potentiel commercial | La valeur possible justifie-t-elle le temps de prospection ? | 10 |
| Compatibilité relationnelle | Le ton, le secteur et les pratiques semblent-ils compatibles avec Yael ? | 5 |

### Lecture du score

- **75 à 100 — Prioritaire** : contacter après vérification humaine des données.
- **50 à 74 — À nourrir** : compléter les informations et préparer une approche douce.
- **0 à 49 — À écarter ou surveiller** : ne pas investir de temps maintenant.

## 3. Fiche prospect duplicable

- Nom de l’organisation : [À vérifier]
- Nom du contact : [À vérifier]
- Fonction : [À vérifier]
- Secteur : [À vérifier]
- Zone géographique : [À vérifier]
- Site ou profil source : [À vérifier]
- Besoin observé : [À vérifier]
- Signal récent : [À vérifier]
- Offre de Yael potentiellement pertinente : [À vérifier]
- Échéance supposée : [À vérifier]
- Décideur identifié : Oui / Non / À vérifier
- Coordonnée professionnelle vérifiée : [À vérifier]
- Score total : /100
- Classement : Prioritaire / À nourrir / À écarter
- Prochaine action : [À vérifier]
- Date de dernière vérification : [À vérifier]
- Notes :

## 4. Requêtes de recherche

Remplacer les éléments entre crochets par les critères réels de Yael.

1. \`site:linkedin.com/in "[fonction cible]" "[ville ou région]"\`
2. \`site:linkedin.com/company "[secteur]" "[ville ou région]"\`
3. \`"[besoin ciblé]" "[ville ou région]" entreprise\`
4. \`"recrute" "[fonction liée au besoin]" "[ville ou région]"\`
5. \`"nouvelle agence" OR "nouveaux locaux" "[ville ou région]"\`
6. \`"appel d'offres" "[secteur de Yael]" "[région]"\`
7. \`"levée de fonds" "[secteur cible]" France\`
8. \`"nomination" "[fonction décideur]" "[secteur cible]"\`
9. \`site:societe.com "[secteur]" "[département]"\`
10. \`site:pagesjaunes.fr "[activité cible]" "[ville]"\`

## 5. Tableau de suivi

| Organisation | Contact | Fonction | Source | Besoin observé | Signal récent | Score | Classement | Coordonnée vérifiée | Prochaine action | Date de suivi | Notes |
|---|---|---|---|---|---|---:|---|---|---|---|---|
| [À vérifier] | [À vérifier] | [À vérifier] | [URL] | [À vérifier] | [À vérifier] | 0 | À qualifier | Non | Vérifier les données | [Date] | |

### En-têtes CSV

\`organisation,contact,fonction,source,besoin_observe,signal_recent,score,classement,coordonnee_verifiee,prochaine_action,date_suivi,notes\`

## 6. Messages de premier contact

### Très court

Bonjour [Prénom], j’ai remarqué [signal réel et vérifié]. Je travaille avec Yael sur [problème concret lié à son offre]. Est-ce un sujet d’actualité chez vous ?

### Conversationnel

Bonjour [Prénom], je me permets de vous écrire après avoir vu [source ou signal vérifié]. Cela laisse penser que [besoin formulé prudemment] pourrait être un sujet pour vous. Yael accompagne précisément [type de besoin réel]. Est-ce pertinent d’en parler quelques minutes, ou préférez-vous que je vous envoie d’abord un résumé très court ?

### Email professionnel

**Objet : [Signal observé] et [bénéfice pertinent]**

Bonjour [Prénom],

J’ai vu que [fait vérifié et source]. Dans ce contexte, vous pourriez être confronté à [besoin formulé comme hypothèse].

Yael intervient sur [description exacte de l’offre à confirmer] afin de [bénéfice concret sans promesse excessive].

Seriez-vous disponible pour un échange de 15 minutes, ou souhaitez-vous recevoir une présentation synthétique avant de décider ?

Bien cordialement,
[Signature]

## 7. Procédure de qualification en 15 minutes

1. **3 minutes — Vérifier l’identité** : organisation, contact, fonction, site officiel et coordonnée professionnelle.
2. **4 minutes — Chercher un signal réel** : actualité, recrutement, déménagement, lancement, publication, demande ou changement récent.
3. **3 minutes — Relier le besoin à l’offre** : écrire une phrase expliquant pourquoi Yael pourrait être pertinente, sans inventer.
4. **3 minutes — Noter la grille** : attribuer chaque score et conserver la source utilisée.
5. **2 minutes — Décider** :
   - 75–100 : prioritaire ;
   - 50–74 : à nourrir ;
   - 0–49 : à écarter ou surveiller.

## Informations indispensables à demander à Yael

- formulation exacte de son offre ;
- zone géographique ;
- types de clients déjà servis ;
- panier moyen ou valeur minimale acceptable ;
- secteurs à privilégier ou exclure ;
- durée habituelle du cycle de vente ;
- ton de contact souhaité ;
- preuve ou référence qu’elle autorise à citer.

${COMPLETE_MARKER}`;
  }

  function completeMission(detail) {
    if (alreadyCompleted()) return null;
    const payload = detail?.payload || {};
    const result = detail?.result || {};
    const metadata = payload?.context?.metadata || {};
    if (metadata.seedId !== YAEL_SEED_ID) return null;

    const status = String(result.status || "").toLowerCase();
    if (!["queued", "recorded", "running", "waiting-executor", "waiting-compatible-executor"].includes(status)) return null;

    const content = buildKit();
    const harvest = global.GardenStore?.addHarvest?.({
      id: `harvest-yael-${Date.now()}`,
      parcelId: YAEL_PARCEL_ID,
      seedId: YAEL_SEED_ID,
      operationId: result.operationId || payload.operationId,
      title: "Kit de préqualification commerciale — Yael",
      status: "ready",
      type: "qualification-kit.markdown",
      preview: "Grille sur 100, fiche prospect, requêtes, tableau de suivi, messages et procédure de qualification.",
      content,
      payload: { source: "poulpe-fiction-local-text-executor", complete: true }
    });

    try {
      global.GardenStore?.upsertOperation?.({
        id: result.operationId || payload.operationId,
        parcelId: YAEL_PARCEL_ID,
        seedId: YAEL_SEED_ID,
        intent: payload.objective || "Préqualification commerciale",
        activity: "Récolte textuelle Yael produite localement",
        status: "ready",
        obstacle: null,
        updatedAt: new Date().toISOString()
      });
    } catch (_) {}

    try { global.GardenStore?.updateSeed?.(YAEL_SEED_ID, { status: "harvested", maturity: 100, harvestedAt: new Date().toISOString() }); } catch (_) {}
    markCompleted();
    try { global.pushChat?.("gerard", "🌾 La récolte Yael est prête : grille, score, fiche prospect, requêtes, messages et tableau de suivi."); } catch (_) {}
    try { global.GardenShell?.setActiveView?.("harvests"); } catch (_) {}
    try { global.render?.(); } catch (_) {}
    try { global.GardenShell?.mount?.(); } catch (_) {}
    return harvest;
  }

  global.addEventListener("poulpe-octopus-result", (event) => completeMission(event.detail));
  global.YaelLocalExecutor = { buildKit, completeMission };
})(globalThis);
