# Audit des studios après fusion — 26 octobre 2026

Base examinée : `70bae54` (inclut le handoff vidéo #142 et les retours créatifs). Aucun état du jardin, média existant, cron, compte ou publication modifié.

## Défauts reproduits et corrigés

| Priorité | Avant : preuve reproductible | Après |
| --- | --- | --- |
| Élevée — autorisation | Le vrai `gerard-cycle.mjs`, avec `GERARD_IMAGE_STUDIO_ENABLED=true` et `allowMistralImage:false`, soumettait quand même `mistral.image` | L'interrupteur active le studio, jamais la dépense. Permission du template conservée telle quelle, absence = refus, y compris dans l'ancien adaptateur à callbacks. Test dans un jardin temporaire, serveur bloquant toute exécution réelle |
| Moyenne — choix créatifs | `voiceProvider:elevenlabs`, musique de bibliothèque et gain personnalisé étaient acceptés puis ignorés | Réponses explicites d'indisponibilité avant toute mission ; aucun remplacement silencieux par Piper ou une autre musique. Le faux réglage par défaut `musicGainDb` est retiré |
| Moyenne — prompt | Le sujet était transmis seul, sans style ni ratio choisis | Prompt commun au chemin historique et au nouveau studio, style et ratio transmis |
| Élevée — preuve du fichier | Le descripteur principal pouvait contredire le manifeste, et une durée manquante dans le rapport pouvait neutraliser la comparaison (`NaN`) | Hash/taille du descripteur comparés au manifeste ; durée comparée à la demande de Gérard, pas au rapport. Codecs, dimensions, fréquence, pixels et canaux vérifiés sur le vrai fichier |

Les tests ont d'abord reproduit le refus de dépense écrasé et l'absence de rejet d'un fournisseur demandé mais indisponible. Ils passent après correction. Les validations d'archive Publisher sont corrigées dans la PR compagnon : un manifeste vide ou des octets non-MP4 ne constituent plus un succès.

## Vérification exécutée

- **157 tests Poulpe réussis**, build réussi. Le test du refus utilise le vrai cycle, sans aucun appel fournisseur.
- **88 tests API Publisher réussis**, types/build réussis.
- E2E réel local : cycle `cultivate` dans un jardin temporaire, Octopus, routes Express, Piper français et FFmpeg ; archive vérifiée par le client, puis réutilisation vérifiée par le serveur. Aucune génération externe, publication ou dépense fournisseur. La preuve JSON est dans la PR Publisher compagnon.
- Les retours créatifs et `videoAssetId` ajoutés récemment sont conservés ; leurs tests de transmission passent.

## Ce qui reste non démontré

Le catalogue Publisher examiné contient le visuel officiel, **aucune captation vidéo enregistrée**. Le nouveau chemin `videoAssetId` exige donc encore un vrai MP4 de jeu, sa provenance/droits, son import au catalogue, puis un rendu intégré avec Piper. Une CI verte de la captation ou de la transmission d'identifiant ne prouve pas cette chaîne. Aucun fallback silencieux vers une image ni aucune captation fictive n'est ajouté.

Les notes créatives sont transmises et archivées ; elles ne prouvent pas que le montage respecte automatiquement chaque instruction libre. Le résultat reste à relire et écouter. Connexion Canva/ElevenLabs, quota disponible et fichier effectivement produit restent trois choses distinctes. Aucun test payant n'est lancé pour combler cette absence de preuve.

Les correctifs sont proposés en PR séparées après les fusions existantes, sans fusion ni déploiement par cet audit. Aucun abonnement, secret, budget ou circuit social changé.
