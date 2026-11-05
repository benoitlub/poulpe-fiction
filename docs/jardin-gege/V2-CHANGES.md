# Jardin des Gégé V2 — audit et changements

26 octobre 2026. Base auditée : `63bfa8f6397049b8aa103b1c6ca21f03675f89ed` de `benoitlub/poulpe-fiction`. Proposition isolée sur `codex/gege-v2-characters`, sans fusion ni déploiement de la page publique.

## Constats de l’audit

- `Gege.tsx` dessinait un hamster pour les ouvriers et pour Gérard via un booléen `chief`, y compris dans le portrait central. Cette identité était également décrite dans les documents et le prompt Lovable.
- `main.tsx` réunissait scène, commandes de caméra, données et inspecteurs. Le décor utilisait un SVG 1000 × 650 mais le monde gardait une largeur minimale de 600 px sur mobile : une partie des ateliers sortait du cadre.
- Le zoom réduisait les étiquettes et les cibles tactiles ; la caméra gérait un seul pointeur. Douze missions pouvaient superposer des hamsters du même métier.
- Le flux `useGardenFeed` est déjà séparé du rendu. Les sept métiers, les six états, les parcelles, la déduplication, les erreurs, les historiques et le journal sont réutilisables tels quels.

## Correction livrée

| Fichier | Responsabilité |
| --- | --- |
| `prototypes/gege/Gerard.tsx` | Poulpe coordinateur à huit tentacules, utilisé dans la scène et le portrait du noyau. Aucune simulation de décision. |
| `prototypes/gege/Gege.tsx` | Hamsters des sept métiers, silhouettes et outils conservés ; suppression de la variante de coordinateur. |
| `prototypes/gege/Garden.tsx` | Scène extraite de `main.tsx`, regroupement visuel, parcelles, légende et liste des missions d’un métier. |
| `prototypes/gege/useGardenCamera.ts` | Cadrage adaptatif, limites de déplacement, zoom, clavier, glissement et pincement. Aucun accès aux événements métier. |
| `prototypes/gege/main.tsx` | Branche les composants visuels, conserve lecture, filtres, projection, journal, historique et inspecteurs. |

Un hamster représente un métier avec au moins une mission dans les filtres actuels, sept maximum. La légende affiche les sept métiers et les nombres exacts par état, y compris les métiers sans trace. Les listes de groupe et la vue synthétique permettent d’inspecter toutes les missions.

Pour une animation de groupe, une mission représentative est choisie parmi les traces existantes : échec, blocage, en cours, reprise, attente, terminé. Cet ordre est uniquement une priorité d’affichage. Il ne change ni l’état des missions ni une décision de Gérard. `visualState` continue de déterminer le mouvement et le blocage ; aucune transition n’est fabriquée.

## Navigation et mobile

Le cadrage initial contient tout le monde, avec une marge. « Tout le jardin » le restaure. Zoom de 100 à 400 % par boutons, clavier ou pincement ; raccourcis vers les sept zones. Les déplacements sont bornés pour conserver le jardin accessible.

La page reste défilable par défaut sur écran tactile. « Explorer au toucher » active le glissement à un doigt et le zoom à deux doigts, avec une indication visible. La capture des pointeurs est transférée après un déplacement réel ; les clics accidentels après glissement sont supprimés. Annulation et redimensionnement réinitialisent le geste. Flèches, +/− et Début restent disponibles au clavier.

Les personnages restent des cibles d’au moins 44 px, indépendamment du zoom. Les noms des métiers, les états, les parcelles et les commandes sont hors de la transformation de caméra. Les noms de zones intégrés au décor sont masqués lorsque le cadrage serait trop petit ; leurs boutons lisibles restent disponibles. Les animations respectent la pause et la réduction des mouvements.

## Validation réalisée

- `npm test` : **123 tests réussis**, aucune erreur.
- `tsc -p prototypes/gege/tsconfig.json --noEmit` : réussi.
- `npm run build` : réussi. Bundle du jardin : environ **81,35 Ko gzip** pour le JavaScript, sans nouvelle dépendance de production.
- `check.cjs` : démo, reprise, conservation d’un échec, mode réel, filtres, cache hors ligne, réponse invalide, état vide, focus, réduction des animations et absence de requête d’écriture.
- `check-v2.cjs` : identité du poulpe et des hamsters, huit tentacules, sept métiers, accès à toutes les missions regroupées, conservation du journal, cadrage aux largeurs **320, 390, 844 et 1440 px**, absence de débordement horizontal, cibles de 44 px, clavier, raccourcis de zones, véritable pincement à deux doigts émulé via CDP, glissement et annulation.
- Axe : aucune violation détectée sur les vues ordinateur et mobile dans les scénarios testés. Aucun événement JavaScript non géré ni requête d’écriture.

Les transports réseau sont interceptés dans les tests ; les scénarios de démonstration restent signalés fictifs. Les tests n’appellent pas Publisher ni un fournisseur. Les tests tactiles sont effectués dans Chromium émulé : une vérification manuelle sur Safari iOS et sur appareil physique reste souhaitable avant intégration visuelle définitive.

## Préservation et passage à Lovable

Vérification du diff : aucun changement dans `src/garden-gege/`, `garden/`, `scripts/`, `.github/workflows/` ou `package.json`. Les décisions, rêves, jeux, cycles autonomes, données enregistrées, contrats et raccordement GET Publisher restent identiques. Aucune génération ou publication n’est déclenchée. La page publique actuelle est conservée.

Le document `LOVABLE-HANDOFF.md`, son prompt et le README du prototype ont été corrigés. Lovable peut remplacer les deux composants de personnages et le décor sur sa branche, en conservant la caméra, les états observés, la légende et les inspecteurs. Cette livraison est un prototype de validation ; elle ne réalise pas la future direction artistique complète.
