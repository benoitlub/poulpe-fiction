# Le Jardin des Gégé — prototype isolé

Le prototype appartient à Poulpe Fiction. La home existante est conservée. Le build principal ajoute le jardin sous `dist/jardin-gege/`. Aucun outil de production n’est appelé.

Depuis la racine du dépôt, avec Node 22.12+ (vérifié ici avec Node 24) :

```sh
npm install --legacy-peer-deps
node scripts/gege-snapshot.mjs
npx vite --config prototypes/gege/vite.config.mjs
```

Ouvrir `http://localhost:4174`. Le mode par défaut affiche **DONNÉES FICTIVES**. « Traces réelles » lit un instantané local assaini de `garden/gerard-state.json` ; il ne suit pas les automatisations en direct. Relancer le collecteur après une mise à jour des fichiers sources puis cliquer « Relire ». Les compteurs de cycles terminés ne sont pas des compteurs de publications.

```sh
node --test tests/garden-gege.test.mjs
npx tsc -p prototypes/gege/tsconfig.json
npx vite build --config prototypes/gege/vite.config.mjs
npx vite preview --config prototypes/gege/vite.config.mjs --port 4174
```

Le build indépendant est dans `dist-gege/`, ignoré par Git. `npm run build` construit aussi cet aperçu, génère un instantané assaini, puis le copie dans `dist/jardin-gege/` pour le workflow GitHub Pages existant. URL dédiée : https://benoitlub.github.io/poulpe-fiction/jardin-gege/. La home historique et `mobile-v2.html` restent accessibles. Sans le fichier réel généré, le mode réel affiche un état hors ligne ; il ne remplace jamais les données manquantes par de la démo.

Les Gégé sont de petits hamsters anthropomorphes habitant le jardin aquatique. Gérard et les sept métiers partagent le composant SVG `Gege.tsx` : oreilles rondes, abajoues, petites pattes, tenues et outils spécialisés. Les sept métiers sont inspectables. Les filtres, le carnet des événements, le mode synthèse et les commandes de caméra fonctionnent au clavier. Une reprise fictive peut être déclenchée explicitement dans l’inspecteur d’une mission bloquée/échouée, puis une réussite fictive ; l’historique de l’échec reste visible. La préférence système de réduction des animations est respectée.

Voir [l’audit](../../docs/jardin-gege/AUDIT.md), [le contrat TypeScript](../../src/garden-gege/contracts.ts) et [le passage à Lovable](../../docs/jardin-gege/LOVABLE-HANDOFF.md).

Vérification navigateur facultative, serveur local déjà démarré (outils de test installés hors du package de production) :

```sh
npm install --prefix /tmp/gege-qa playwright @axe-core/playwright
PLAYWRIGHT_BROWSERS_PATH=/tmp/gege-browsers /tmp/gege-qa/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/gege-qa/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/gege-browsers node prototypes/gege/check.cjs
```

`GEGE_PREVIEW_URL` change l’URL testée ; `GEGE_ARTIFACTS` change le dossier des captures. Le scénario navigateur observe l’instantané local existant en lecture seule et utilise les événements de démonstration pour les transitions. Il ne soumet aucune commande métier. Le test d’enveloppe vide utilise un instantané synthétique sans mission.

Pour retirer seulement cet aperçu, supprimer l’appel à `npm run build:gege` du script `build` puis relancer le déploiement Pages. Le workflow publie un nouvel artefact complet ; la home ne dépend pas du jardin.
