# Audit et raccordement réel — 25 octobre 2026

Le jardin utilise désormais un lecteur réutilisable (`src/garden-gege/useGardenFeed.ts`) et un point de lecture hébergé par Publisher :

`GET https://blacklace-publisher-worker.benoitlubert.workers.dev/api/garden/v1/snapshot`

## Audit de l’état actuel

- Poulpe inspecté à `0dac44dec31849e024f5afd80561af9cacfe982b` ; Publisher à `57589ad8ee009acde247f0e0e3b81bdda3eac4a0` ; Octopus à `a46822958afd017bf30cb07ef156781cc789d4d7`.
- Le dépôt Lovable accessible reste à `011868f68c1d82a70e29ccbcf0b73e184220f436`. Ses éventuels changements dans l’éditeur ne sont pas visibles dans GitHub. Aucun fichier de ce dépôt n’est modifié.
- Le fichier `snapshot.json` précédent dépendait du déploiement Pages. La nouvelle lecture récupère la dernière révision GitHub à chaque collecte : elle ne dépend plus d’une reconstruction du site pour voir de nouvelles traces.
- Les cycles s’exécutent aussi dans GitHub Actions avec un Octopus local. Un journal vide sur le Worker Octopus ne couvre pas ces exécutions. La lecture associe donc le journal disponible aux traces durablement conservées par Poulpe.
- À la révision auditée : 50 cycles conservés, 27 récoltes admissibles, 21 correspondances exactes cycle/récolte, 32 récoltes compostées exclues. Le dernier cycle observé date du 24 octobre à 16:03:04 UTC. Ces chiffres ne constituent pas une preuve d’activité le 25 octobre.
- Certaines décisions `ai-rate-limited-deferred` et `mock-rejected-deferred` sont enregistrées avec `outcome: ok`. L’adaptateur les traduit maintenant en `blocked`, et non en succès de la mission.

## Sources et fidélité

Le collecteur lit la révision `main` de Poulpe via GitHub, puis fixe **le même SHA** pour `restart-seeds.json`, `gerard-state.json` et `harvests.json`. Il lit uniquement `/events` chez Octopus, via son service binding Cloudflare quand il est disponible. Il n’utilise pas les endpoints Publisher qui initialisent un schéma ou réenregistrent un adaptateur.

Les récoltes de Publisher sont observées **via les enregistrements conservés dans Poulpe**, pas par interrogation directe de Neon. Une récolte doit avoir un contenu non vide, la route `octopus->publisher-adapter`, un état admissible et l’identifiant exact écrit par `saveHarvest`. Son suffixe `-harvest` la rattache à son cycle. Aucun événement de démarrage absent n’est fabriqué. Une correspondance historique n’est pas une preuve de l’intégralité des transitions du moteur.

L’identité, les prompts, les contenus de récolte, les prospects, les messages d’erreur bruts et les credentials ne sont jamais sérialisés. Les trois parcelles autorisées sont intersectées avec celles effectivement configurées. Les libellés sont fixés côté code ; les titres libres des sources ne passent pas dans la réponse. Le résultat « récolte enregistrée » est distinct de « publication ». Les sorties simulées, les placeholders Sofia historiques, le compost et les archives ne deviennent pas des succès.

Les sources connues n’offrent pas toujours d’URL de résultat exploitable : aucun lien n’est inventé. La lecture n’expose pas de contenu privé afin de créer artificiellement un bouton résultat.

## Contrat et transport

Le contrat version 1 est conservé, avec un champ optionnel `sources` (identifiant, lisible/indisponible, date de lecture, dernière trace). `transport: snapshot` reste explicite : ce sont des instantanés relus toutes les 60 secondes, pas un flux WebSocket ni une promesse de temps réel instantané.

Le navigateur démarre en mode réel, sans fallback vers des données fictives. La démo reste accessible séparément. Une source en échec produit « SOURCES PARTIELLES » ; une réponse illisible, « RÉPONSE INVALIDE » ; une coupure, « HORS LIGNE ». Les animations de travail sont suspendues hors connexion complète, sans modifier les états métier.

Les lectures sont GET, sans cookies ni clé navigateur. Le collecteur ne résout que le token GitHub déjà configuré, uniquement pour l’appel API GitHub public. Le token n’est ni envoyé à raw.githubusercontent.com, ni renvoyé au navigateur. La réponse est une projection publique et volontairement limitée ; ce n’est pas une API d’accès aux missions privées.

## Charge, sécurité et rétention

- Sources à URL fixe ; aucune URL ou filtre utilisateur n’est transmis à l’amont. Paramètres de requête refusés, méthodes autres que GET refusées.
- Délais par requête de 6 secondes, limite de 2 Mio par source, redirections refusées. Échecs génériques 503 sans diagnostic privé.
- Cache technique de 45 secondes dans l’isolate et mutualisation des requêtes concurrentes. Ce cache ne crée aucun événement métier et n’écrit dans aucune base.
- Lecteur : une requête active, annulation et rejet des réponses dépassées, reprise avec délai croissant jusqu’à 5 minutes, arrêt en arrière-plan, reprise au retour réseau/onglet.
- Déduplication et conservation des événements déjà vus pendant la session, y compris après relecture partielle et bascule démo/réel. Les historiques amont restent bornés : 50 cycles et jusqu’à 100 récoltes dans le script de production. Le journal Octopus reste en mémoire. Une archive durable complète est toujours à réaliser ; cette livraison n’en simule pas une.

## Coordination avec Lovable

Importer `useGardenFeed(mode)`, puis `projectMissions(snapshot?.events ?? [], mode)`. Ne pas copier les effets réseau dans les composants visuels. La seule modification de la page actuelle est le branchement de ce hook et ses informations d’état ; les SVG de hamsters, le décor, les styles et les gestes de caméra ne changent pas.

Le Worker embarque une copie exacte de `contracts.ts`, `core.mjs`, `core.d.mts`, `feed.mjs`, `feed.d.mts` dans `publisher-worker/src/garden/`. La source canonique est Poulpe ; toute évolution du contrat doit recopier ces cinq fichiers ensemble et rejouer les tests des deux dépôts. Aucun package externe n’est ajouté pour le jardin.

## Vérification et déploiement

Tests synthétiques : cycles différés, lien exact cycle/récolte, exclusions, payloads privés, erreurs partielles, GET seulement, service binding, cache, polling, reconnexion, annulation et conservation des historiques. Les tests navigateur interceptent le transport et n’appellent pas le service réel. Les lectures de contrôle après déploiement ne lancent aucune mission.

Déployer le point de lecture Publisher avant le lecteur Poulpe. Garder la home historique et la route `/jardin-gege/`. Vérifier une lecture publique réelle, les états des trois sources et l’absence de payload privé. Le retour arrière consiste à retirer le branchement du hook ; aucune migration de base n’est nécessaire.
