# Le Jardin des Gégé — prototype isolé

Le prototype appartient à Poulpe Fiction. La home existante est conservée. Le build principal ajoute le jardin sous `dist/jardin-gege/`. Aucun outil de production n’est appelé.

Depuis la racine du dépôt, avec Node 22.12+ (vérifié ici avec Node 24) :

```sh
npm install --legacy-peer-deps
node scripts/gege-snapshot.mjs
npx vite --config prototypes/gege/vite.config.mjs
```

Ouvrir `http://localhost:4174`. Le mode réel relit toutes les minutes le point de lecture Publisher `/api/garden/v1/snapshot` : états de Gérard, récoltes enregistrées et journal Octopus disponible. Les dates de lecture et de dernière trace sont distinctes. La démo reste explicitement fictive ; une panne ne bascule jamais automatiquement sur celle-ci. L’historique est partiel, et les cycles terminés ne sont pas des publications. Voir [l’audit du raccordement](../../docs/jardin-gege/READONLY-FEED.md).

Le fichier local `snapshot.json` est toujours généré pour l’archive et les vérifications du build, mais ne fournit plus la source périodique de la vue réelle.

```sh
node --test tests/garden-gege.test.mjs
npx tsc -p prototypes/gege/tsconfig.json
npx vite build --config prototypes/gege/vite.config.mjs
npx vite preview --config prototypes/gege/vite.config.mjs --port 4174
```

Le build indépendant est dans `dist-gege/`, ignoré par Git. `npm run build` construit aussi cet aperçu, génère un instantané assaini, puis le copie dans `dist/jardin-gege/` pour le workflow GitHub Pages existant. URL dédiée : https://benoitlub.github.io/poulpe-fiction/jardin-gege/. La home historique et `mobile-v2.html` restent accessibles. Si le point de lecture est inaccessible, le mode réel affiche un état hors ligne et conserve les traces déjà lues pendant la session.

Les Gégé sont de petits hamsters anthropomorphes habitant le jardin aquatique. Gérard est un poulpe coordinateur, dessiné séparément dans `Gerard.tsx` (huit tentacules, manteau turquoise et lunettes de cuivre). Les sept métiers utilisent `Gege.tsx` : oreilles rondes, abajoues, petites pattes, tenues et outils spécialisés. Les sept métiers sont inspectables. Les filtres, le carnet des événements, le mode synthèse et les commandes de caméra fonctionnent au clavier. Une reprise fictive peut être déclenchée explicitement dans l’inspecteur d’une mission bloquée/échouée, puis une réussite fictive ; l’historique de l’échec reste visible. La préférence système de réduction des animations est respectée.

Voir [l’audit](../../docs/jardin-gege/AUDIT.md), [le contrat TypeScript](../../src/garden-gege/contracts.ts) et [le passage à Lovable](../../docs/jardin-gege/LOVABLE-HANDOFF.md).

Vérification navigateur facultative, serveur local déjà démarré (outils de test installés hors du package de production) :

```sh
npm install --prefix /tmp/gege-qa playwright @axe-core/playwright
PLAYWRIGHT_BROWSERS_PATH=/tmp/gege-browsers /tmp/gege-qa/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/gege-qa/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/gege-browsers node prototypes/gege/check.cjs
```

`GEGE_PREVIEW_URL` change l’URL testée ; `GEGE_ARTIFACTS` change le dossier des captures. Le scénario navigateur observe l’instantané local existant en lecture seule et utilise les événements de démonstration pour les transitions. Il ne soumet aucune commande métier. Le test d’enveloppe vide utilise un instantané synthétique sans mission.

Pour retirer seulement cet aperçu, supprimer l’appel à `npm run build:gege` du script `build` puis relancer le déploiement Pages. Le workflow publie un nouvel artefact complet ; la home ne dépend pas du jardin.


## V2 — validation avant intégration

La branche `codex/gege-v2-characters` corrige le prototype existant, sans le déployer ni remplacer la version publique. `Garden.tsx` contient la scène ; `useGardenCamera.ts` contient uniquement la navigation ; `main.tsx` conserve la lecture des données et les inspecteurs. Aucun fichier de `src/garden-gege/`, `garden/`, `scripts/` ou `.github/workflows/` n’est modifié.

Le bouton « Tout le jardin » cadre l’ensemble, y compris à 320 px. Le zoom va de 100 à 400 % du cadrage initial. Les boutons et les flèches du clavier déplacent la scène, Début rétablit le cadrage. Sur mobile, la page défile par défaut ; « Explorer au toucher » active le glissement à un doigt et le pincement à deux doigts. Les parcelles et la légende des métiers ne sont pas réduites par le zoom.

Un hamster au maximum par métier avec missions observées ; les sept métiers restent dans la légende. Cliquer sur un hamster ou son métier ouvre la liste complète des missions de ce groupe, puis chaque mission ouvre son inspecteur habituel. La priorité visuelle est échec, blocage, en cours, reprise, attente, terminé : seul l’état réel d’une mission représentative pilote son animation. Les compteurs indiquent les états exacts de tout le groupe. Les métiers sans trace ne reçoivent aucun personnage actif.

Tests navigateur (Playwright + axe installés séparément, aucune nouvelle dépendance de production) :

```sh
GEGE_PREVIEW_URL=http://localhost:4175 node prototypes/gege/check.cjs
GEGE_PREVIEW_URL=http://localhost:4175 node prototypes/gege/check-v2.cjs
```

Ces tests interceptent le transport Publisher et n’appellent aucune API réelle. Rapport : [V2-CHANGES.md](../../docs/jardin-gege/V2-CHANGES.md).
