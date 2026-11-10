# Audit et réparation de l’autonomie — 10 novembre 2026

Branche : `fix/gerard-autonomy-learning-loop`. Base : `61eb7d2`.
Aucune fusion automatique, aucune génération payante, aucun message commercial,
aucune publication ou modification de programmation exécutés pendant cet audit.
Les expériences de régression sont des **simulations déterministes**. Elles ne
prouvent ni audience supplémentaire, ni vente, ni génération Mistral réelle.

## Exécutions réelles et corrections déjà présentes

### Run demandé du 7 novembre

[42347307533](https://github.com/benoitlub/poulpe-fiction/actions/runs/42347307533)
utilise Poulpe `5a591d4`. Les services démarrent et l’adaptateur s’enregistre.
À 06:31:53 UTC, la parcelle `bazar-du-feuch` retourne `studio-production-blocked`.
Le rapport **réel**, téléchargé dans l’artefact `13564410711`, est :

`publisher/data/studio/jobs/730c3aacb108d63ec4c511451c3e9cef06dc156e0014395176c4bbb3d1594214/report.json`

Il contient `status:failed`, `code:MISTRAL_IMAGE_UNCONFIRMED`, `published:false`.
L’ancien adaptateur image échouait au contrôle conjoint réponse HTTP / statut
`generated` / `fileId`. Ce code générique ne permet pas de distinguer un refus,
un quota ou une conversation sans fichier : **la cause amont exacte n’est plus
reconstituable à partir de ce rapport**. Ne pas inventer un 429.
La persistance privée a néanmoins réussi : version **63**, fichier
`gerard-studio-state.json` sauvegardé à 06:31:54 UTC. L’échec n’était donc pas une
perte totale de l’état entre exécutions.

Depuis, #187 conserve les résultats avant téléchargement et rend les codes
visibles. Le correctif FFmpeg de validation est déjà présent sur `main` : aucune
réinstallation ou nouvelle PR de ce correctif n’est nécessaire ici.

Publisher a également changé : le commit
[0d563e2 / PR #200](https://github.com/benoitlub/blacklace-publisher-ai/commit/0d563e2)
préfère la clé locale Studio, conserve le checkpoint image et transmet les erreurs
structurées (`httpStatus`, `retryAllowed`, `providerOutcomeMayBeUnknown`, modèle et
étape). L’ancien diagnostic « toutes les erreurs image sont masquées en 502 »
ne doit donc **pas** être présenté comme l’état actuel de ce code.
Le Publisher examiné pour comparaison est `35e91d9` sur `origin/main`.

### Runs récents vérifiés

| Run | Constat vérifiable | Limite |
| --- | --- | --- |
| [42841766082](https://github.com/benoitlub/poulpe-fiction/actions/runs/42841766082), Studio, 10 novembre | Échec **avant** `Run Gerard cycle` : `Model checksum mismatch; refusing synthesis.` durant le setup Piper | Pas une nouvelle preuve d’échec Mistral ; ne pas désactiver le contrôle de hash |
| [42864632670](https://github.com/benoitlub/poulpe-fiction/actions/runs/42864632670), apprentissage | Snapshot Metricool du **29 octobre**, huit mesures relues ; `rankingEnabled:false`. Notion : `no-new-confirmed-outcome`. PostgreSQL : version **105**, learning et advice sauvegardés | Réintégrer un ancien snapshot ne prouve pas une mesure nouvelle ni une amélioration |
| [42838490351](https://github.com/benoitlub/poulpe-fiction/actions/runs/42838490351), production | Symbiose `ok`, version privée **103** sauvegardée | Aucun nouveau produit ou résultat commercial démontré |
| [42876078387](https://github.com/benoitlub/poulpe-fiction/actions/runs/42876078387) | Workflow déclenché par issue, jobs non applicables : `skipped` | L’ouverture de #210/#211 n’a pas lancé de prospection réelle |

## Causes racines corrigées et preuves

| Cause | Fichiers corrigés | Preuve automatisée |
| --- | --- | --- |
| La diffusion perdait `postId` et le statut fournisseur dans `.delivery`, consommé ensuite par l’apprentissage | `scripts/gerard-metricool-publication.mjs` | Le test à deux cycles utilise cette fonction réelle et clôt une expérience après mesure attribuée |
| Un résultat pouvait être attribué à une explication d’une autre récolte ; une expérience clôturée était recréée au prochain passage | `scripts/gerard-learning-cycle.mjs` | Identités contradictoires rejetées ; expérience clôturée non rouverte |
| Les consignes de transport n’avaient pas d’effet direct dans la sélection suivante | `scripts/gerard-learning-cycle.mjs`, `scripts/gerard-social-selection.sh` | Le vrai script passe `excludeHarvestIds` tiré des résultats. Test avec et sans mémoire, choix différent et justification enregistrée |
| Un `harvestId` ambigu entre parcelles, ou un post technique, pouvait clôturer une expérience | `scripts/gerard-social-feedback.mjs` | Ambiguïté non attribuée ; identifiant de parcelle/seed ne clôt que son expérience |
| La rétention bornée des observations permettait de réingérer des mesures déjà connues ; date d’intégration confondable avec date de mesure | `scripts/gerard-social-feedback.mjs` | Déduplication avec le dernier snapshot retenu ; âge et date du snapshot restent explicites |
| Notion pouvait transformer un label `published` non confirmé en « publication confirmée » | `scripts/gerard-notion-memory.mjs` | Test séparant programmation, reçu fournisseur et label seul |
| La présence d’une image **optionnelle** excluait la parcelle de prospection de Production | `scripts/gerard-cycle.mjs` | Le test vérifie l’éligibilité réelle de `benoit-client-acquisition`, sans activer Mistral image |
| Tous les Studios dépendaient de Piper, y compris les images seules | `scripts/gerard-cycle.mjs`, `.github/workflows/gerard-studio.yml` | La même sélection calcule le média requis avant les dépendances ; cas image/vidéo testés. Le contrôle Piper reste obligatoire pour audio/vidéo |
| Le nouveau rapport Publisher d’issue incertaine pouvait être retenté après changement de runner | `scripts/gerard-provider-retry.mjs`, `scripts/gerard-av-studio.mjs`, workflow Studio | Deux appels après résultat incertain = une seule soumission ; checkpoints Publisher et Gérard conservés dans le cache existant |
| Une restauration ancienne pouvait écraser une configuration source revue | `scripts/gerard-private-runtime.mjs` | Hydratation conserve les nouvelles Seeds et restaure l’apprentissage privé |
| Une étape aval en échec pouvait empêcher la sauvegarde des résultats du tentacule | Workflows Learning/Runtime existants | Persistance conditionnée à une restauration réussie, y compris après échec aval, sans workflow supplémentaire |
| Brouillons commerciaux envoyables sans validation humaine ; contact perdu dans la mémoire de recherche | `scripts/gerard-mail-outbox.mjs`, `scripts/gerard-autonomous-mail.mjs`, `scripts/gerard-b2b-memory.mjs` | Aucun brouillon non approuvé éligible ; approbation liée au hash exact ; modification du destinataire ou du texte invalide l’approbation |
| La prospection produisait surtout une liste, sans dossier ni conséquence d’un refus | `scripts/gerard-client-acquisition.mjs`, cycle, Seeds | Trois cibles bornées ; dossier, fiches manquantes, brouillon, action datée ; refus vérifié relu depuis la mémoire ⇒ ne pas relancer ; autre client isolé |

Les exclusions apprises concernent **la récolte exacte**, expirent après trois
heures et ne modifient aucun post programmé. Une autre parcelle reste éligible.
Ce n’est ni une interdiction permanente, ni un classement statistique.
Les résultats fournisseur incertains restent en revue plutôt qu’être relancés
silencieusement : leur effet externe peut déjà avoir eu lieu.

## Démonstration reproductible : deux cycles

```sh
node --test tests/gerard-autonomy-two-cycles.test.mjs
node --test tests/gerard-autonomy-commercial.test.mjs
npm test
npm run build
```

`gerard-autonomy-two-cycles.test.mjs` exécute le **vrai script de sélection Bash**
avec un Publisher local simulé et les véritables fonctions de diffusion,
d’apprentissage et de sérialisation privée :

1. Décision initiale : `fixture-h1`, contenu explicitement simulé.
2. Diffusion simulée : reçu d’échec, observation `transport-failed`, aucun succès
   d’audience inféré.
3. Capture des fichiers → sauvegarde PostgreSQL **simulée** → projection publique
   → hydratation privée. La mémoire existante est conservée.
4. Deuxième invocation du sélecteur : demande excluant `fixture-h1`, choix
   `fixture-h2`. `memoryAdaptation` cite le résultat précédent et son identité.
5. Reçu de publication puis mesure attribuée **simulés** sur la seconde récolte :
   expérience clôturée, pas de classement de performance inventé.
6. Contre-épreuve : sans mémoire et avec le même sélecteur, retour à `fixture-h1`.
   **Ignorer la mémoire fait échouer l’assertion du deuxième cycle.**

Le test commercial prouve séparément que la mémoire d’un refus vérifié évite de
recréer une nouvelle prise de contact, même sans l’ancien brouillon dans l’outbox.
Aucune conclusion statistique de hausse de ventes ou d’audience n’est tirée.
Aucun code ne se réécrit : il s’agit d’une adaptation stratégique déterministe.

Validation locale : **201 tests réussis, zéro échec**, build complet réussi,
`git diff --check` réussi. Aucun test réel de production payante ou de publication.

## Prospection #210 et #211 : livrable utilisable et limites

Les [trois dossiers de revue](../prospection/2026-11-10-editeurs-a-valider.json)
contiennent les brouillons complets, fiches par jeu, prochaine action datée et
preuves de lecture (URL et SHA-256). Les pages officielles ont réellement été
récupérées en HTTP 200 le 10 novembre ; cette recherche publique n’est pas une
simulation. L’assemblage automatique et les scores restent des aides de revue.

| Acteur | Canal vérifié | Proposition préparée / information manquante |
| --- | --- | --- |
| Don’t Panic Games | https://www.dontpanicgames.com/fr/contact/ | Demander la procédure et l’acceptation actuelle des projets Pro.Hibited, Prout.Hibited et Jointed. L’observation en magasin rapportée par Benoît est un indice, pas une preuve de ventes ou d’intérêt. Aucune politique de soumission ouverte confirmée |
| Gigamic | https://www.gigamic.com/contact | La page référence « Auteur de jeux » et une FAQ de présentation. Les pages détaillées liées n’ont pas pu être lues : ne pas déclarer leurs conditions vérifiées |
| IELLO | https://iello.fr/contact-s-a-v/ | Le formulaire distingue « auteur » et « éditeur ». Utiliser ce parcours, **pas le SAV** ; aucune acceptation actuelle de prototype confirmée |

Les trois messages sont prêts à **relire comme demandes de procédure**, pas
comme offres commerciales complètes. Pour chaque jeu, les règles, nombre de
joueurs, âge/durée, droits, prototype et conditions commerciales sont marqués
manquants. Aucune description de mécanique, quantité disponible, prix, vente,
intérêt d’un éditeur ou adresse personnelle n’a été inventée. Les fiches devront
être complétées à partir d’une source produit revue avant un pitch de prototype.
Le code alimente la même outbox privée au prochain cycle Production ; les
fichiers de cette PR ne prétendent pas être déjà présents dans PostgreSQL.

La reprise commerciale utilise les statuts existants et le résultat vérifié :
préparation → validation humaine → envoi autorisé → réponse/attente → revue de
relance/refus/accord. Une relance ne part jamais automatiquement. L’absence de
réponse reste inconnue, pas un refus. Un accord ne prouve aucun encaissement.
Aucune collecte automatique de réponses Gmail n’est déclarée vérifiée ici ;
le résultat doit être lié à une preuve de réponse, et non un statut inventé.

Pour rendre un brouillon éligible à l’envoi existant, Benoît doit approuver le
message et le destinataire exacts : `status:human-approved`, puis un objet
`approval` contenant `ownerGitHub:benoitlub`, une date `approvedAt` et
`operationId` calculé par `mailOperationId(draft)`. Le runner n’envoie que cette
révision et garde la réservation fournisseur existante. Les brouillons sans
adresse vérifiée restent des demandes via formulaire et ne partent pas en Gmail.
**Aucune approbation d’envoi n’a été créée par cet audit.**

## Bilan factuel

| État | Conclusion |
| --- | --- |
| Fonctionnel et vérifié en production | Des restaurations et sauvegardes privées PostgreSQL réelles sont attestées dans les logs ; la mémoire et des mesures historiques sont conservées. Les contrôles de sécurité empêchent bien l’usage d’un modèle vocal au hash non conforme |
| Corrigé et testé | Décision suivante modifiée par un résultat antérieur après persistance simulée ; attribution et clôture ; reçus conservés ; trois dossiers de prospection ; approbation humaine liée à la révision ; isolation client/parcelle ; reprise sans double génération |
| Bloqué par un accès/service externe | Les lectures directes du Publisher depuis cet environnement (`healthz`, Knowledge preview et statut Metricool existant) retournent HTTP **403**, corps `error code: 1010`. Cela prouve un refus d’accès depuis cet environnement, **pas une panne de Publisher**. Le modèle vocal non conforme reste refusé pour audio/vidéo |
| Non encore vérifié en conditions réelles | Nouvelle image Mistral après les correctifs actuels ; nouvelle mesure Metricool attribuée après le 29 octobre ; réponse commerciale ; aller-retour PostgreSQL des nouveaux champs ; synchronisation Notion d’un nouveau résultat ; effet de ces adaptations sur audience ou ventes |

La collecte actuelle du workflow Learning demande une **capacité analytics** au
Publisher ; elle ne rafraîchit pas elle-même le snapshot de mesures par post.
L’ancien snapshot reste donc explicitement ancien. Aucun endpoint de statistiques
ou secret supplémentaire n’a été inventé pour masquer ce manque de données.
La boucle technique est démontrée par un changement de décision explicable ;
l’amélioration commerciale réelle n’est pas encore établie.

La PR doit être revue sans fusion automatique. Pour une confirmation en réel,
observer les prochains cycles existants après fusion : décision et
`memoryAdaptation`, état de diffusion réellement confirmé, date/attribution des
mesures, puis sauvegarde/restauration privée. Une nouvelle génération payante ou
un contact commercial nécessite son autorisation distincte. Un statut Actions
vert reste insuffisant pour conclure à la réussite de l’autonomie.
