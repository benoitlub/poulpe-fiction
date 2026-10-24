# Issue #114 — cultivate B2B et découverte Composio

Le cycle demande une capacité métier à Octopus. Le runtime enregistrait une API Express qui n'implémentait pas `business.sources.search`, alors que cette capacité existait uniquement dans le Worker Publisher. Un HTTP 200 incomplet devenait `ok`, puis zéro source aboutissait à `harvest-failed`. Le run [40091774609](https://github.com/benoitlub/poulpe-fiction/actions/runs/40091774609) montre cet échec. Le run vert [40109686686](https://github.com/benoitlub/poulpe-fiction/actions/runs/40109686686) exécutait `symbiosis` ; il ne prouve pas une prospection B2B.

Les corrections conservent le moteur et le cron existants :

- L'enregistrement existant ajoute `business.sources.search` et `tool.execute`. Publisher Express relaie ces capacités et la découverte au Worker ; les identifiants restent côté serveur.
- Gérard fournit le besoin du seed (`businessSearchQuery` ou `objective`), sans slug technique. La mission autorise explicitement `tools.read` et désactive le dry-run seulement pour la lecture demandée.
- Le cycle accepte des sources uniquement après mission Octopus terminée et exécution confirmée de recherche. Il conserve statut, raison, outil choisi, trace, budget et Retry-After.
- Une recherche B2B ne dépend plus d'une fiche Notion, d'un marqueur de section freelance ou de génération Mistral. Elle peut fonctionner sans `knowledgeSlug` pour ce seed ; les autres graines gardent leur exigence de contexte.
- Une erreur de connexion, un quota, une preview ou une liste vide ne crée aucune récolte. Retry-After suspend le seed concerné ; il ne suspend pas les autres projets et ne déclenche aucun retry rapide.
- Une récolte de sources reste `harvested`, à qualifier ; elle n'est pas déclarée `ready-to-offer`. Son compteur de prospects qualifiés, contacts et commandes reste zéro. Un contenu identique de la même parcelle/seed est réutilisé, pas ajouté en doublon.
- Le journal d'apprentissage garde la cause exploitable au lieu du seul `harvest-failed`.

Tests réellement exécutés :

- `npm test` : **108 réussis**, dont quatre nouveaux tests qui exécutent le vrai script dans des jardins temporaires avec un serveur Octopus simulé.
- `npm run build` : réussi, y compris Jardin des Gégé. Les fichiers de build/snapshot générés ont été restaurés ; aucun état réel du jardin changé.
- Depuis Publisher : **un E2E complet** avec le vrai cycle de cette branche, Octopus `a46822958afd017bf30cb07ef156781cc789d4d7`, les deux adaptateurs Publisher et cinq états Composio. Composio/SQL simulés ; aucune génération payante ni contact réel. Le test valide aussi l'inventaire, la preview et la répétition sans nouvel appel.
- Worker : 116 réussis / 1 ignoré (Postgres non configuré), API : 71, régressions sociales : 3 E2E réussis ; builds et types validés.
- `git diff --check` réussi. Le workflow opérationnel ne change que sa liste de capacités ; cron `17 */3 * * *`, déclencheurs, secrets et étapes sociales conservés. Aucun workflow réel n'a été lancé pour tester cultivate.

Les sources de test sont des fixtures `example.org`, pas des prospects. **Résultat commercial réel de cette mission : zéro prospect vérifié, zéro contact envoyé, zéro vente, zéro publication.** Les trois diagnostics Worker renvoient HTTP 403 / Cloudflare 1010 depuis l'environnement Codex. La CI Publisher collecte séparément des métadonnées réelles depuis GitHub, sans exécution de fournisseur ; son rapport et le tableau d'accessibilité sont joints à la PR.

Dépend de la PR Publisher de l'issue #114 pour le relais et le contrôleur dynamique. Les identifiants Composio ne sont pas ajoutés au runtime Poulpe. Les lectures externes autres que le Search géré existant, les outils payants et les écritures restent soumis aux connexions et autorisations appropriées ; une découverte ou une connexion active ne vaut jamais réussite d'exécution.

CI vérifiées : [108 tests et build Poulpe](https://github.com/benoitlub/poulpe-fiction/actions/runs/40124269989) et [vrai cycle + Octopus + deux adaptateurs Publisher](https://github.com/benoitlub/blacklace-publisher-ai/actions/runs/40124344849) passent. Les trois diagnostics de production répondent HTTP 200 depuis le runner le 24/10 à 19:14 UTC : Composio/utilisateur configurés, dix schémas Search retournés, zéro compte OAuth Search listé. Le planner valide une preview sur ces métadonnées réelles avec authentification gérée par Composio ; aucune recherche fournisseur réelle exécutée. Cela remplace le blocage réseau local pour l'inspection des métadonnées, sans prouver l'exécution ou les crédits disponibles. [PR Publisher #146](https://github.com/benoitlub/blacklace-publisher-ai/pull/146) contient le snapshot expurgé et les autres CI vertes.

Restent la revue et la mise à disposition contrôlée des deux PR, puis la vérification des crédits et d'une lecture effectivement autorisée en production. Aucune reconnexion OAuth n'est demandée pour le Search géré sur la seule base de zéro compte listé.

Aucune source Octopus modifiée, nouveau cron/agent, modification de secrets/budgets, suppression de récolte réelle, annulation de publication, déploiement ou fusion.
