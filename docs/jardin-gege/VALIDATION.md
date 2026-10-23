# Validation du prototype — 23 octobre 2026

## Vérifications réalisées

- `npm test` : **90 tests réussis**, dont 10 nouveaux tests Jardin des Gégé. Fixtures des adaptateurs explicitement marquées fictives dans la suite ; aucun appel aux services de production par ces tests.
- `npx tsc -p prototypes/gege/tsconfig.json` : réussite.
- `npm run build` : build historique réussi, avec les avertissements existants sur les scripts classiques sans `type="module"`. Le fichier `build-info.js` généré a été remis à son contenu d’origine.
- `npx vite build --config prototypes/gege/vite.config.mjs` : build isolé réussi. JS ~249 ko (78,7 ko gzip), CSS ~9,3 ko (3 ko gzip) ; React inclus, aucun moteur 3D ni police distante. Ces tailles ne remplacent pas une mesure sur appareil physique.
- Chromium : vue 1440 × 1100 et 390 × 844, pas de débordement horizontal de page sur mobile, inspection avec focus, filtres, synthèse, reprise fictive puis réussite avec conservation de l’échec, rejet d’une réponse invalide, état vide, coupure réseau avec maintien des traces déjà lues, réduction des animations.
- Axe WCAG 2 A/AA et WCAG 2.1 AA : **aucune violation détectée** sur les deux vues testées. Cela ne vaut pas audit complet au lecteur d’écran.
- Aucune erreur JavaScript et aucune requête d’écriture pendant le scénario navigateur. Le seul accès aux sources réelles effectué hors tests est la lecture de `/events` d’Octopus (réponse vide) ; le navigateur lit le fichier local assaini.
- Comparaison Git : `index.html`, `mobile-v2.html`, `vite.config.mjs`, `package.json`, `garden/` et `.github/` inchangés.

## Dette existante vérifiée sur la base

`npm run typecheck` global échoue avec les trois mêmes erreurs sur la branche et dans un worktree propre à `8e778ca` :

- `PoulpeFictionApp.tsx:73` : namespace `React` absent ;
- `GerardScreen.tsx:204` : `.slice` sur `unknown` ;
- `GerardScreen.tsx:220` : propriété `compost` absente de son `GardenSnapshot` existant.

Ces fichiers ne sont pas modifiés. Le contrat du nouveau jardin est un module indépendant. Les dépendances du projet historique utilisent `latest` ; la reproductibilité des installations reste à traiter séparément.

## Critères d’acceptation

| Critère | État de cette livraison |
| --- | --- |
| Mobile et ordinateur | Prototype vérifié sous Chromium aux deux tailles ; appareils réels et autres navigateurs à valider |
| Sept métiers identifiables | Hamsters anthropomorphes présents, tenues/outils et inspecteur ; marche avec cargaison à finaliser avec Lovable |
| Flux réel de bout en bout | **Non validé**. 50 traces réelles historiques affichées ; journal distant vide à la lecture |
| Mission échouée | Fixture inspectable, reprise et historique testés ; observation d’un incident réel à compléter |
| Absence de faux événements en mode réel | Validation, filtrage et tests de séparation ; pas de minuteur de réussite |
| Informations techniques consultables | Source, événement, révision, état et historique accessibles |
| Routines sans régression | Sources/workflows inchangés et 90 tests réussis ; aucune routine active déclenchée pour tester |
| Ancienne home conservée | Oui, build et entrées historiques inchangés |
| Historiques durables complets | **À réaliser côté collecteur** ; rétention amont limitée, cache session du prototype uniquement |
| Publication de la nouvelle home | **Non effectuée**, phases C/D requises |

Cette livraison couvre l’audit et un prototype fonctionnel isolé. Elle ne prétend pas achever la refonte de production.

## Direction artistique : hamsters

Gérard, les sept métiers et les portraits utilisent désormais la même silhouette de hamster. Les textes UI, commentaires du composant, descriptions et référence de génération Lovable ont été harmonisés. Typecheck et build du prototype réussis après cette modification ; scénario Chromium ordinateur/mobile et Axe relancés avec succès, sans erreur JavaScript ni requête d’écriture. Les captures et l’archive d’aperçu ont été régénérées.
