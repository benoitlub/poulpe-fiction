# Le Jardin des Gégé — audit et prototype isolé

Audit du 23 octobre 2026. Le prototype est une greffe dans Poulpe Fiction, sans remplacement de sa home. Sa direction artistique représente Gérard et les Gégé comme de petits hamsters anthropomorphes spécialisés, habitants du jardin aquatique. Les fichiers de production et les workflows ne sont pas modifiés.

## Sources inspectées

| Dépôt | Révision inspectée | Rôle constaté |
| --- | --- | --- |
| [poulpe-fiction](https://github.com/benoitlub/poulpe-fiction) | `8e778ca05f0bdd0e46c6a2b141befb047d77d547` | Propriétaire des parcelles, graines, récoltes, décisions et interface Gérard |
| [octopus-engine](https://github.com/benoitlub/octopus-engine) | `a46822958afd017bf30cb07ef156781cc789d4d7` | Exécution neutre, registre d’adaptateurs, événements et cycle de vie |
| [blacklace-publisher-ai](https://github.com/benoitlub/blacklace-publisher-ai) | `ca829447e8d09dfca57d06a708b516f82c250d81` | Providers, production, diffusion, Worker Cloudflare et stockage Neon |
| [octopus-engine-app](https://github.com/benoitlub/octopus-engine-app) | `315e6137d6069e98ef7ed77e31f4986afee04079` | Dépôt apparenté au moteur ; ne pas confondre le nom du dépôt avec celui du Worker déployé |
| [g-rard-s-activity-garden](https://github.com/benoitlub/g-rard-s-activity-garden) | `011868f68c1d82a70e29ccbcf0b73e184220f436` | Prototype Lovable React 19/TanStack Start ; composant ActivityEcho existant |

Les trois premiers dépôts ont été récupérés dans des copies locales. Les arbres des cinq dépôts et les fichiers pertinents du prototype Lovable ont été lus via GitHub. Aucun dépôt Publisher/Octopus ni branche Lovable n’a été modifié.

## Home et déploiement

`poulpe-fiction/index.html` est l’entrée historique du build Vite ; `mobile-v2.html` charge l’interface React existante. La configuration `vite.config.mjs` construit ces deux entrées sous `/poulpe-fiction/`. Le workflow `.github/workflows/deploy-pages.yml` publie `dist` après un push sur `main`. Il est donc exclu d’y intégrer une home non validée.

Le prototype possède sa propre configuration `prototypes/gege/vite.config.mjs`, son entrée HTML et son dossier de sortie `dist-gege`. Le build normal ne l’inclut pas. L’ancienne home reste exactement à sa place : retour arrière immédiat, aucune migration de données à annuler.

Sources réutilisables : `garden-domain.js`, `garden-store.js`, `poulpe-octopus-adapter.js`, `publisher-client.js`, les composants React mobile et les adaptateurs `src/poulpe-fiction-mobile-v2/runtime/`. Le nouveau lecteur n’importe pas leurs scripts d’autonomie : ouvrir le prototype ne doit pas démarrer un travail.

## Réalité des flux

`runtime-config.js` désigne actuellement les Workers `octopus-engine-app.benoitlubert.workers.dev` et `blacklace-publisher-worker.benoitlubert.workers.dev`. `docs/garden-deployment-contract.md` cite encore Render : cette documentation ne décrit plus les URL courantes.

Le workflow Gérard (`.github/workflows/gerard-runtime.yml`, cron `17 */3 * * *`) lance aussi un Octopus local et un adaptateur Publisher local. Le journal d’un Worker distant n’est donc pas nécessairement celui des cycles GitHub Actions. `scripts/gerard-cycle.mjs` conserve `history` sur 20 entrées et `learningHistory` sur 50 entrées ; le dernier instantané audité contient 50 observations et 53 récoltes. Une trace `ok` signifie un cycle réussi ; elle ne prouve ni la qualité du contenu ni une diffusion extérieure.

`src/event-store.ts` d’Octopus conserve un journal append-only **en mémoire** avec `id`, `sequence`, `kind`, `streamId`, `source`, `occurredAt`, `payload`, `correlationId` et `causationId`. Le 23 octobre, une lecture de `GET /events` du Worker configuré a renvoyé `{ "events": [] }`. Aucun appel POST ni lancement de mission n’a été effectué. Ce résultat vide ne constitue pas un incident. Il ne permet pas de valider un flux complet en direct.

| Source actuelle | Information exploitable | Limite / décision |
| --- | --- | --- |
| Octopus `GET /events`, `GET /missions/:id` | Transitions neutres et références d’exécution | Mémoire volatile, payload potentiellement privé ; collecteur serveur obligatoire avant exposition publique |
| Poulpe `garden/gerard-state.json` | Modes, opérations, résultats, décisions et erreurs | Historique tronqué en amont ; le prototype affiche explicitement une couverture partielle |
| Poulpe `garden/harvests.json` | Contenus et provenance des livrables | Ne pas envoyer les textes privés au navigateur ; pas de lien de résultat inventé |
| Poulpe `garden/compost-report.json` | Raisons du compost, compteurs, identifiants conservés | Compost éditorial différent d’une erreur d’exécution |
| Poulpe `garden/gerard-learning.json` | Observations, diffusion, leçons et disponibilité des mesures | Une hypothèse ou observation n’est pas un apprentissage prouvé |
| Poulpe `garden/verified-external-publications.json` | Preuves de publications vérifiées | À raccorder à une mission seulement par corrélation explicite |
| Publisher `GET /api/tentacles/state` et `/iterations` | État Neon et itérations | Appellent `ensureSchema` ; pas des lectures strictement sans écriture |
| Publisher `GET /api/health` | État et enregistrement de l’adaptateur | Peut réenregistrer Publisher auprès d’Octopus ; exclu du sondage du prototype |
| Publisher `/api/production/execute`, `/api/tentacles/run-cycle`, transport social | Création réelle et diffusion | Commandes exclues des tests et de la vue de supervision |

Les parcelles du mode réel proviennent de `garden/restart-seeds.json` : Poulpe Fiction, Yaébali, parcelle professionnelle. La présence de 420 Dice et d’autres univers ailleurs dans le code ne suffit pas à les afficher comme actifs dans cette projection restreinte. Aucune connexion Metricool ou Canva n’est déclarée active sans preuve récente.

## Contrat livré et règles de projection

Le contrat partagé est `src/garden-gege/contracts.ts`, la validation et les adaptateurs sont dans `core.mjs`. Il reste à étendre après validation des besoins de streaming et d’authentification ; la version 1 livrée annonce uniquement un transport `snapshot`.

- Provenance `demo` / `real` obligatoire sur l’enveloppe et chaque événement. Le lecteur réel rejette les fixtures de démonstration, même si leur enveloppe est renommée.
- Déduplication par `(sourceSystem, sourceEventId)` ; un doublon contradictoire est rejeté, jamais utilisé pour réécrire une erreur. Tri par date, séquence puis identifiant. L’horloge n’invente pas d’étape.
- Identité de mission par `(sourceSystem, missionId)` ; pas de rapprochement entre deux systèmes fondé seulement sur leurs titres.
- `received`, `recorded`, `planned` deviennent `queued` ; `executing` devient `running` ; les attentes d’exécuteur/autorisation deviennent `blocked` ; `rejected` devient `failed`.
- Un statut inconnu est exclu et compté, jamais converti par défaut en activité ou réussite.
- Les historiques restent dans la projection après disparition d’un chemin, réussite d’une reprise ou relecture d’un instantané. Le prototype les conserve pendant la session ; cela ne remplace pas une archive durable côté serveur.
- Les métadonnées arbitraires, prompts, résultats textuels et messages d’erreur bruts sont écartés. Les erreurs affichées sont génériques, avec référence de trace. Aucun jeton n’est attendu dans le navigateur.
- Les liens de résultats sont facultatifs, HTTPS et soumis à une liste explicite d’hôtes publics ; aucune URL signée, avec identifiants ou paramètres n’est exportée. La politique d’accès aux futurs livrables privés reste à définir.
- Les métiers sont une projection de capacités ou de modes existants. Un rôle inconnu reste un Passeur, sans créer un nouvel agent.

## Connexion réelle à préparer (phase C)

Prévoir un collecteur serveur et `GET /api/garden/v1/snapshot`, même origine, authentifiés et filtrés par utilisateur/parcelle. Réponse conforme au contrat ; erreurs 401/403/503 explicites ; cache privé, taille bornée, timeout et annulation ; ETag facultatif. Les accès doivent être contrôlés **avant** la sérialisation. Ne pas ajouter une clé dans `VITE_*`.

La source doit enregistrer durablement les événements, inclure les exécutions GitHub Actions et corréler explicitement opération Gérard, mission Octopus et livrable Publisher. La pagination/cursor et la rétention doivent être définies avant un transport `live` ; un curseur expiré doit signaler une lacune, pas prétendre à un historique complet. Les lectures Publisher doivent être séparées de `ensureSchema` et de l’auto-enregistrement pour tenir la promesse de lecture seule.

Le collecteur local livré lit uniquement des fichiers et n’effectue aucun appel réseau. Il ne constitue pas encore cette API serveur. Aucune migration de base, activation de connecteur ou commande de publication n’est introduite.

## Passage à la home

La phase C et la validation d’au moins un cycle réel complet restent requises. Observer un cycle planifié autorisé ; comparer ses transitions, ses erreurs et son livrable dans les sources et dans le jardin. Ne pas lancer une publication pour les besoins du test. Valider les accès privés, les reconnexions après redémarrage du moteur et la rétention durable. Ensuite seulement, proposer une entrée alternative sous indicateur de fonctionnalité, conserver une route explicite vers l’ancienne home, puis faire valider le déploiement. Aucun déploiement n’est inclus dans cette livraison.
