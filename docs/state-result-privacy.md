# Résumé public du dernier cycle

`scripts/gerard-state-summary.mjs` limite `gerard-state.json.lastResult` à une
liste explicite de métadonnées opérationnelles. Les réponses sources complètes,
prompts, textes de livrables, coordonnées et messages d'erreur libres ne sont
plus recopiés dans cette partie du journal ni dans la ligne `gerard-cycle.done`.
Les résultats complets restent disponibles en mémoire pendant le cycle.

Les identifiants, statuts, compteurs, reports et marqueurs de simulation sont
conservés. La rotation, la mémoire de recherche, les historiques et les récoltes
ne sont pas remplacés par ce résumé. Il ne constitue jamais une preuve de
publication ou de performance.

## Limites de cette première correction

Cette réduction concerne uniquement `lastResult` et la ligne de fin du cycle.
Elle ne rend pas confidentiel le dépôt public. Les autres snapshots, les
récoltes, les brouillons, les autres lignes de logs et l'historique Git peuvent
encore contenir des données de travail. L'historique n'est pas réécrit.

La séparation durable entre données privées et flux public nécessite un stockage
privé persistant explicitement configuré. Ne pas déplacer la mémoire métier vers
un fichier temporaire sans reprise entre les cycles, ni supprimer des récoltes
utilisées par le jardin sous prétexte de filtrage.

## Validation

`node --test tests/gerard-state-summary.test.mjs tests/garden-gege.test.mjs tests/garden-feed.test.mjs`

Les tests vérifient la suppression des sources imbriquées, la conservation des
diagnostics utiles, des échecs et des marqueurs mock, l'idempotence et le maintien
de la mémoire de rotation. La suite complète s'exécute aussi avant le déploiement
Pages ; la validation habituelle couvre maintenant les pushes sur `main`.
