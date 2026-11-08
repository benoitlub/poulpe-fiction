# Gérard : production d’images, diagnostic du 8 novembre 2026

## Périmètre et preuves

Base examinée : `5a591d4b89955b37f1c4ce74fad7ab9f81e9e48d` de poulpe-fiction.
Lecture seule du Publisher : `388824d4e6f18d9e7872f455db7118dd74e7cd89`.
Aucun secret, budget, compte ou contenu programmé modifié. Aucun appel réel
Mistral, aucun envoi social et aucune programmation lancés pendant ce travail.
Les images des tests sont des fixtures locales, jamais des générations Mistral.

La requête Actions `created=2026-09-25..2026-10-06` a retourné 87 runs,
dont 19 « Gerard runtime ». Les journaux de ces 19 runs ont été lus.
Aucune preuve d’un fichier Mistral récupéré et publié le 6 octobre n’y a été
retrouvée. La publication Instagram signalée par Benoît reste une preuve
historique fournie par le propriétaire ; son run exact et son identifiant
Instagram ne sont pas identifiés. Aucun rapprochement artificiel avec le
workflow 420 n’est fait.

Preuves reproductibles dans Actions :

| Run | Observation | Ce que cela prouve |
| --- | --- | --- |
| [37423945345](https://github.com/benoitlub/poulpe-fiction/actions/runs/37423945345), 6 octobre | `knowledge-ready-awaiting-garden-decision` | Contexte Notion préparé, aucune image démontrée |
| [37492144344](https://github.com/benoitlub/poulpe-fiction/actions/runs/37492144344), 6 octobre | Même décision | Un workflow vert ne suffit pas |
| [37542127844](https://github.com/benoitlub/poulpe-fiction/actions/runs/37542127844), 6 octobre 22:42 UTC | `media-failed`, « Mistral completed the conversation but returned no generated image file_id. » | Conversation terminée sans fichier exploitable ; pas la preuve de la publication du jour |
| [42256728197](https://github.com/benoitlub/poulpe-fiction/actions/runs/42256728197), 6 novembre | `studio-production-blocked`, Pro.Hibited Online | Échec Studio, cause amont non visible dans le résumé d’origine |
| [42406962881](https://github.com/benoitlub/poulpe-fiction/actions/runs/42406962881), 7 novembre | Rapport archivé `publisher/data/studio/jobs/1bf742475b84ce87c0e4a54457c576c0b3b23231aff0b52a8febb7c4bdb19e06/report.json` : `MISTRAL_IMAGE_UNCONFIRMED`, SpecTRL | Échec de confirmation image, aucune preuve que ce soit un 429 |
| [42472604748](https://github.com/benoitlub/poulpe-fiction/actions/runs/42472604748), 8 novembre | `studio-files-ready-for-review`, 420 Dice vidéo, `published:false` | Fichiers annoncés pour revue ; pas une nouvelle génération Mistral démontrée |
| [42471073387](https://github.com/benoitlub/poulpe-fiction/actions/runs/42471073387), 8 novembre | Recherche B2B différée puis `cannot rebase: You have unstaged changes` | Incident Git après cycle, indépendant de Mistral |

Les métadonnées des 112 runs du 5 au 8 novembre ont été récupérées en deux
pages. Les journaux de runs récents ciblés ont été inspectés, sans prétendre
avoir inspecté tous leurs artefacts. Les journaux historiques ne livrent aucun
identifiant de média ou de programmation permettant de relier la publication
Instagram du 6 octobre à une exécution précise.

## Quotas : circuit et limites du diagnostic

Dans [le Worker Publisher examiné](https://github.com/benoitlub/blacklace-publisher-ai/blob/388824d4e6f18d9e7872f455db7118dd74e7cd89/publisher-worker/src/worker.ts) :

- Texte : `POST https://api.mistral.ai/v1/chat/completions`, modèle configuré
  par `MISTRAL_MODEL`, défaut `mistral-small-latest`, puis au maximum deux
  modèles alternatifs : `ministral-8b-2512` et `ministral-3b-2512`.
- Image : création d’agent via `/v1/agents`, modèle `mistral-medium-latest`,
  outil `image_generation`, puis `/v1/conversations` et enfin téléchargement
  `/v1/files/{fileId}/content`. Un nouvel agent est créé à chaque tentative.
- Le texte peut tenter immédiatement les modèles alternatifs après 429.
  La regexp du code examiné pour les secondes de `Retry-After` contient un
  double antislash dans un littéral regexp : elle ne reconnaît pas les chiffres
  ordinaires. Même sa branche de délai court ne temporise pas avant failover.
  C’est une source possible d’appels inutiles ; ce n’est pas une preuve que
  tous les échecs observés proviennent d’un quota partagé.
- L’endpoint image transforme toutes les exceptions en HTTP 502. Les erreurs
  de création d’agent/conversation perdent le statut HTTP et `Retry-After`.
  Le Studio local réduit ensuite cette réponse à `MISTRAL_IMAGE_UNCONFIRMED`.
  Il est donc impossible, à partir de ce rapport, de distinguer débit, budget,
  permissions ou absence de fichier. Un 429 ne prouve jamais une génération.
- Les workflows Production et Studio utilisent le même nom de secret
  `MISTRAL_API_KEY` pour leurs services locaux. Le Worker déployé lit ses propres
  paramètres ; l’identité de ses clés et le partage effectif des quotas ne sont
  pas vérifiés. Les workflows ont des groupes de concurrence distincts et
  peuvent se chevaucher.

**Limite externe précise :** le correctif de poulpe-fiction respecte un 429 et
son délai lorsqu’ils lui sont transmis. Il ne peut restaurer des informations
que Publisher a supprimées. Il faut préserver, dans Publisher, le service,
l’endpoint, le modèle, le statut et `Retry-After` sans exposer les clés ; ne pas
renvoyer tous les échecs en 502. Aucun modèle ayant réellement reçu un 429
pendant les incidents Studio ci-dessus n’est identifié avec certitude. Aucun
relevé de quota du compte Mistral n’a été consulté.

## Corrections de ce dépôt

- `gerard-provider-retry.mjs` : interprétation de `Retry-After` en secondes ou
  date HTTP ; repli de 15 minutes sans en-tête exploitable, sans inférer le type
  de limite. Aucun retry en boucle dans une invocation.
- Studio : checkpoint de réponse terminée avant téléchargement. Un échec de
  récupération réutilise le résultat distant au lieu de soumettre une nouvelle
  mission. Les checkpoints de 429 expirent automatiquement ; une réponse de
  mission simplement acceptée ne devient pas une production réussie.
- Ancien adaptateur image : sauvegarde du `fileId` avant téléchargement et
  reprise avec ce même identifiant ; conservation de la validation par décodage.
- Workflow Studio : restauration/conservation des fichiers et checkpoints entre
  runners via le cache Actions existant ; les artefacts de diagnostic restent
  téléchargables, y compris après échec. Le cache peut être évincé : sa rétention
  ne constitue pas un archivage permanent garanti.
- Validation Studio : ajout d’un décodage ffmpeg au contrôle ffprobe existant.
- Résumé public : codes d’échec Studio et preuves de récupération conservés,
  prompts et corps de contenu toujours exclus. Le résultat conserve `reused`
  pour distinguer une archive existante d’une production nouvelle.
- Cycle : les fournisseurs indisponibles sont `deferred` au lieu de `ok` ;
  le cooldown textuel respecte les délais amont transmis sans raccourcir le
  backoff existant. Les autres tentacules continuent indépendamment.
- Publication via les API de ce script : avant exécution, un contrôle HEAD
  refuse média absent, vide, non HTTPS ou de type non média avant tout POST de
  programmation. Ce contrôle d’accessibilité complète la validation Studio ;
  il ne remplace pas un décodage ni la confirmation du réseau destinataire.
- Workflow 420 : décodage effectif avec Pillow et conversion PNG avant livraison,
  conservation du hash des octets source et de la réponse même après échec.

Pas de refonte des templates ou d’élargissement des autorisations. La configuration
actuelle autorise explicitement Mistral image pour les huit projets concernés.
Le refus par défaut est conservé. `MOBILE_TITLE_TOO_LONG` vient du validateur
Publisher (titre > 26 caractères), avant génération ; les titres de ces huit
projets sont déjà courts. L’incident Git de projection et la sélection éditoriale
sans contenu diffusable restent distincts et ne sont pas corrigés par cette PR.

## États et preuve requise

| Étape | Preuve acceptable | Insuffisant |
| --- | --- | --- |
| Appel Mistral tenté | Journal du fournisseur avec endpoint/modèle/date | Mission Studio seule |
| Appel accepté | Réponse amont et agent/conversation ID | 429, statut global Actions |
| Image générée | `generated` et `fileId`, confirmés par récupération | Conversation terminée seule |
| Image récupérée | Octets archivés, taille et SHA-256 | URL ou identifiant seul |
| Prête pour diffusion | Décodage, dimensions, droits et destination validés | `ready-for-review` seul |
| Effectivement publiée | État confirmé par le transport, postId et vérification réseau | Mission acceptée ou programmation seule |

L’adaptateur direct fournit `image-studio.json` et `image-attempt.json` ; le Studio
fournit `submission.json`, `mission.json`, `report.json` et les fichiers dont les
hashes sont vérifiés. Un média enregistré existant ne prouve aucun appel Mistral.
Les preuves de tentative/acceptation Mistral restent limitées par la visibilité
amont décrite ci-dessus. `readyForDiffusion:false` et `published:false` sont
intentionnels pour les sorties Studio en revue.

## Validation et confirmation réelle

Résultats : `npm test` **190/190 réussis**, `npm run build` réussi,
`git diff --check` réussi.

Tests de régression entièrement simulés : 429, secondes/date HTTP, absence
d’en-tête, temporisation, reprise à expiration, absence de fichier malgré réponse
positive, refus d’une URL média 404/HTML, récupération interrompue sans nouvelle
génération, hash invalide, archive réutilisée, autorisations et confirmation de
publication. Une fixture PNG locale est produite par ffmpeg et réellement décodée.
Aucun appel Mistral n’est exécuté par ces tests.

Pour confirmer une **nouvelle génération réelle**, après revue et fusion :

1. Autoriser explicitement le test consommant des crédits. Ne pas confondre cette
   autorisation avec l’autorisation de publier. Ce test n’a pas été lancé ici.
2. Lancer manuellement « Gerard Reel 420 visual proof » avec
   `generate_ai_image=true`, `capture_live_gameplay=false`, `harvest_id` vide.
   Ce circuit existant ne programme aucune publication et permet une tentative
   unique de génération. Ne pas relancer à l’aveugle après une réponse incertaine.
3. Télécharger `gerard-420-dice-mistral-attempt`. Vérifier le `fileId`, les octets
   PNG décodables, les dimensions et le SHA-256 source de `ai-result.json`.
4. Conserver run ID, date, identifiants agent/conversation/fichier et le hash.
   En cas d’échec 502/UNCONFIRMED, investiguer Publisher avec son diagnostic amont
   plutôt que conclure à un quota ou recommencer les générations.
5. Confirmer ensuite une production Studio pour un projet choisi, avec ses
   fichiers et son rapport. Une archive `reused:true` n’est pas une nouvelle image.
   Revue des droits et préparation de diffusion restent nécessaires. Toute
   publication ultérieure relève d’une action séparée et n’appartient pas au test.

La PR testée est le livrable technique. La réparation complète reste à confirmer
par une nouvelle génération réelle et par la levée des limites amont documentées.
