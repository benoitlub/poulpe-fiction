# Extension Buffer + Metricool — 22 octobre 2026

Gérard choisit le projet, le texte, les médias et la destination. Publisher vérifie les capacités de ce compte ; Octopus exécute la mission `social.publish` existante. Les circuits existants et le cron sont conservés ; aucun fichier de workflow ne change dans cette PR.

Cette PR dépend de [#110](https://github.com/benoitlub/poulpe-fiction/pull/110), elle-même basée sur [#109](https://github.com/benoitlub/poulpe-fiction/pull/109). Publisher fournit le parcours de transport dans sa PR Buffer, basée sur [#140](https://github.com/benoitlub/blacklace-publisher-ai/pull/140).

Le client existant `scripts/gerard-metricool-publication.mjs` expose maintenant aussi `bufferMission` et `submitBufferPublication`. Ils n'entrent pas dans le cron : leur appel est opt-in. Une mission Buffer exige un canal choisi dans `candidate.transport.channelId`, une seule destination Instagram, le texte exact et une image. Elle passe par l'Octopus existant, conserve sa clé d'opération entre répétitions, et utilise par défaut `dryRun:true`. Aucun jeton n'est transmis par Gérard. Publisher conserve le secret d'exécution côté serveur.

Le client Metricool refuse désormais toute combinaison contenant un réseau non supporté au lieu de la réduire silencieusement. Les missions précédentes restent compatibles ; les livres Buffer ne passent pas dans Metricool.

| Capacité | Buffer | Metricool |
| --- | --- | --- |
| Connexion actuelle / canaux réels | Non vérifiés : diagnostic Worker HTTP 403 ; connecteur de session Buffer inactif | Non vérifiés : diagnostic Worker HTTP 403 ; compte du projet Composio inaccessible ici |
| Parcours simulé avec vrai Gérard et Octopus | Brouillon → lecture par ID → édition du même ID dans la file → lecture `scheduled` avec date → répétition sans mutation | Texte Facebook et image Facebook/Instagram → quota → programmation → statut par ID → répétition sans mutation |
| Quota | Limites commerciales et compteur mensuel non vérifiés | Comptage complet simulé publié/programmé/réservé, plafond existant de 20 ; consommation réelle non vérifiée |
| Preuve de livraison | Seulement `completed` + statut fournisseur confirmé + indicateur booléen + ID ; un ID seul ne suffit pas | Même exigence |

Preuve historique Buffer : le [run 38646496703](https://github.com/benoitlub/poulpe-fiction/actions/runs/38646496703) a retrouvé le brouillon `6acfd4de0b61877d1315e86b` dans 51 posts le 14 octobre, puis sa promotion a été rejetée faute de média dans l'édition. Cela ne prouve pas une publication actuelle. Le [run 38619406815](https://github.com/benoitlub/poulpe-fiction/actions/runs/38619406815) avait auparavant rejeté une demande faute de type Instagram, sans ID créé.

Tests exécutés :

- `npm test` : **94 réussis**, y compris les nouveaux cas Buffer et refus de réseau inconnu.
- `npm run build` réussi ; le `build-info.js` généré a été restauré, sans changement produit parasite.
- Depuis Publisher, les **3 E2E** passent avec `GERARD_CLIENT_PATH` pointant sur ce vrai client, puis les **3 mêmes scénarios** passent avec leurs missions versionnées pour la CI. Tous les transports et le SQL sont simulés ; aucun appel réel d'écriture.
- Aucun diff de `.github/workflows/gerard-runtime.yml` ; `git diff --check` réussi.

Restent à la décision humaine : revoir les PR dépendantes ; rétablir l'accès en lecture aux diagnostics et vérifier les comptes, canaux, droits, quotas et schémas réels ; décider d'une éventuelle disponibilité et activation ultérieures. Pour le nouvel appel Buffer via Octopus, le serveur API doit recevoir le secret Buffer existant et le Worker doit autoriser explicitement l'exécution ; ni configuration ni secret n'ont été changés. Le cron continue son circuit antérieur.

Aucune publication, dépense, connexion de compte, modification de secrets/budgets, déploiement, fusion ou modification d'Octopus Engine. Les deux transports sont conservés, sans substitution automatique d'une destination explicite.
