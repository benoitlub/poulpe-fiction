# Audit Gérard / Publisher — 21 octobre 2026

PR concernées : [Poulpe #109](https://github.com/benoitlub/poulpe-fiction/pull/109)
et [Publisher #138](https://github.com/benoitlub/blacklace-publisher-ai/pull/138).
Le [bilan complet avant/après](https://github.com/benoitlub/blacklace-publisher-ai/blob/fix/publisher-exclude-seeds/docs/audits/2026-10-21-stabilisation-publisher.md)
documente les échecs CI, corrections TypeScript, tests et limites.

## Correction de #109

La version `64e78e6f6c6b7179b4e12ab63fa50b61d2ac6e83` excluait déjà le seed
`420-dice` au premier appel et aux alternatives. En revanche, les décisions de
Gérard sur les autres seeds (trois sélections répétées, expérience `explore`)
ne transmettaient que les IDs présents dans `garden/harvests.json`.
Les nouvelles récoltes et l'absence du fichier pouvaient donc annuler ces décisions.

Les seeds choisis sont maintenant transmis dans `excludeSeedIds`, sur tous les
appels, indépendamment de l'inventaire local. Les IDs connus et le secours 420
restent présents. Gérard garde la décision ; Publisher applique le filtre générique.
L'absence de candidat ne déclenche pas une nouvelle requête sans exclusions.

Le cycle opérationnel est limité aux push sur `main`, pour qu'une branche de PR
ne lance pas de publications réelles. Les autres déclencheurs existants sont
conservés. La CI de PR exécute désormais aussi les tests locaux.

## Tests effectivement exécutés

- Suite initiale : **80/80** tests réussis.
- Les sept nouveaux tests, exécutés contre le workflow initial : **4 réussites, 3 échecs** (répétition, exploration, combinaison).
- Suite corrigée `npm test` : **87/87**, dont les sept tests du bloc shell réel, avec `curl` simulé et fichiers temporaires.
- `npm run build` : réussi après `npm install --no-audit --no-fund`, Node 24.19.0 ; avertissements existants sur les scripts classiques, puis copie des assets réussie.
- YAML valide ; `bash -n` réussi pour les 37 blocs Gérard et les 3 blocs de validation ; `git diff --check` réussi.

Aucun cycle réel, publication, programmation, déploiement, changement de secret
ou de budget, ni fusion. Les tests n'appellent pas le Publisher déployé. L'effet
réel dépend encore de la disponibilité du filtre de #138 dans Publisher ; aucun
déploiement n'a été demandé ou effectué dans cet audit. Le HTTP 503
Composio/Metricool reste hors validation. Les chemins autonomes préexistants du
Worker (cron et génération d'images) sont signalés dans le bilan complet, sans
modification d'architecture.
