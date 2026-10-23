# Passage à Lovable — Le Jardin des Gégé

Signature : « Pendant que les idées poussent, les Gégé s’occupent du jardin. »

## Base réutilisée

Le dépôt Lovable `g-rard-s-activity-garden` possède déjà `src/components/activity-echo/` et la route `/gerard`. Son hook `useActivityEcho` tire des libellés au hasard, conserve 50 événements et repasse au calme après huit secondes. Ces comportements conviennent à sa démonstration, mais ne doivent pas déterminer l’état métier en mode réel. Réutiliser le langage visuel et les primitives utiles ; alimenter le rendu depuis la projection normalisée, sans appeler `trigger()` pour simuler l’activité réelle.

## Répartition des fichiers

| Responsable | Zone de travail |
| --- | --- |
| Codex | `src/garden-gege/contracts.ts`, `core.mjs`, collecteurs, tests des données, `docs/jardin-gege/` |
| Lovable | Nouvelle branche `lovable/jardin-gege-visual` ; personnages, scène, styles et interactions |
| Intégration | Importer le contrat validé ; modification de la home dans une PR ultérieure dédiée |

Le prototype Codex dans `prototypes/gege/` est un support concret à reprendre, pas une modification concurrente de la branche Lovable. Aucune branche Lovable n’a été écrite. Ne pas réécrire son historique publié (instruction `AGENTS.md` de ce dépôt).

## Entrée de la vue

Importer `GardenSnapshot`, `GardenMission` et `GardenEvent` depuis le contrat. Utiliser `parseSnapshot` à la frontière et `projectMissions(events, mode)` pour produire les missions. Les méthodes de l’adaptateur restent côté collecteur ; le navigateur reçoit exclusivement les objets autorisés du contrat.

Le jeu `prototypes/gege/demo.ts` couvre les sept métiers et les six états. Il est marqué fictif dans les données et dans l’interface. Les boutons de reprise/réussite sont uniquement dans le mode démo et ajoutent explicitement une trace, sans minuteur de réussite. Le fichier réel local `snapshot.json` est généré par `scripts/gege-snapshot.mjs`, ignoré par Git et jamais chargé en remplacement silencieux de la démo (ou inversement).

## Direction visuelle du prototype

React + SVG 2D, sans moteur 3D, turquoise et eau profonde, îlots mousse, cuivre, sable, serres et passerelles. Sept petits hamsters anthropomorphes, avec couleur, tenue et outil propres à chaque métier, et Gérard, hamster coordinateur, au centre. Oreilles rondes dégagées, abajoues généreuses, museau court, moustaches fines et petites pattes : cette silhouette commune doit rester reconnaissable dans la scène comme dans les portraits. Les routes et l’animation dérivent de `visualState(mission)` : les statuts en cours font circuler le courant ; échec et blocage immobilisent le travail ; une réussite retire la route mais conserve son historique.

À approfondir côté Lovable : marche avec cargaison sur les trajets, transitions entre positions lors de nouveaux événements, détails isométriques, mouvements d’ambiance sobres et découpage de la scène sur petits écrans. Le prototype montre une activité de travail sur place et des canaux animés ; ce n’est pas encore le système final de déplacement des cargaisons.

Douze hamsters maximum visibles ; toute mission reste dans la synthèse. Panoramique tactile, zoom par boutons, déplacement au clavier et mode réduction des animations ; pause explicite. Ne pas masquer l’origine, la date de dernière observation, le caractère partiel d’un historique ou un blocage persistant.

## Garde-fous d’intégration

La lecture de `snapshot.json` est le seul appel réseau applicatif du prototype. L’aperçu est intégré au build Pages sous `/jardin-gege/` après autorisation de mise en ligne ; la home reste conservée. Aucune API de publication, purge, synchronisation, génération ou diagnostic à effets de bord n’est importée. Les bibliothèques de l’ancienne home ne sont pas chargées. Aucune dépendance nouvelle n’est ajoutée au package de production.

Ne pas déduire une connexion fournisseur à partir d’un métier représenté. Ne pas faire progresser une tâche par durée d’animation. Ne pas annoncer un pourcentage absent des données. Une carte résultat ne doit être cliquable que si son URL validée est présente. Les priorités de Gérard non raccordées restent signalées comme indisponibles.


## Personnages et accessoires

Les Gégé habitent le jardin aquatique et travaillent debout sur leurs petites pattes. Leur corps est rond et compact, leur pelage miel et crème, leurs attitudes expressives, ingénieuses et un peu maladroites. Les vêtements sont des accessoires de travail adaptés à leur morphologie. Gérard partage leur anatomie ; son gilet doré, ses lunettes rondes, sa boussole et sa lanterne signalent son rôle de coordinateur.

| Métier | Tenue et accessoires |
| --- | --- |
| Cueilleur | Salopette mousse, panier tressé, pousses aquatiques |
| Tresseur | Salopette sable, carnet ouvert et crayon |
| Enlumineur | Tenue mauve, petit béret entre les oreilles, palette et pinceau |
| Passeur | Tenue turquoise, sacoche en bandoulière et petite pagaie |
| Greffeur | Tenue cuivre, lunettes de bricolage et clé de réparation |
| Jardinier de fond | Tablier végétal, poche à graines et petit râteau |
| Semeur | Tenue pervenche, sachet de semences et graines dans la patte |

Le nom du métier « Jardinier de fond » reste une fonction du système. Tous les personnages, y compris ce métier et Gérard, sont des hamsters. Le composant partagé `prototypes/gege/Gege.tsx` fournit la silhouette et les accessoires aux personnages de la scène et aux portraits ; éviter des versions séparées qui divergeraient.

## Prompt de référence pour les futures illustrations

« Petits hamsters anthropomorphes expressifs vivant et travaillant dans un jardin aquatique miniature en perspective 2,5D. Corps ronds, pelage miel et crème, grandes abajoues, petites oreilles rondes toujours visibles, museau court, fines moustaches et petites pattes. Tenues et outils adaptés à chacun des sept métiers décrits ci-dessus. Gérard est un hamster coordinateur avec gilet doré, lunettes rondes, boussole et lanterne. Bassins translucides, nénuphars, passerelles organiques et ateliers à leur échelle. Turquoise, vert mousse, bleu profond, sable doré et cuivre patiné. Ambiance poétique, habitée, chaleureuse ; silhouettes lisibles sur mobile. »

Exclusions visuelles : nains de jardin, silhouettes humaines, barbes, bonnets pointus, esthétique cyberpunk ou corporate. Les animations de travail restent pilotées par les événements ; une illustration ne constitue jamais une preuve d’activité réelle.

Aucune image générée ni ancien prompt de génération n’était intégré au prototype : les personnages sont des SVG construits dans React. Ce prompt sert de référence commune pour la suite du travail visuel.
