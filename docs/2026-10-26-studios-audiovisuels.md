# Studios audiovisuels par parcelle — 26 octobre 2026

Gérard choisit le sujet, le texte, les médias et le format dans les templates de sa seed. Octopus orchestre une mission métier ; Publisher produit et vérifie les fichiers. Aucun nouveau service, agent, Worker, workflow ou calendrier n'est ajouté.

## Avant / après

Les templates audio/video étaient descriptifs. `image-studio` utilisait déjà Mistral mais vérifiait seulement la signature et la taille d'un téléchargement. Il pouvait accepter un fichier tronqué, ne normalisait pas le format et supposait un outputDir URL.

Les trois templates utilisent maintenant les capacités `image.studio`, `audio.studio`, `video.studio` du même adaptateur Express Publisher. Le client `scripts/gerard-av-studio.mjs` vérifie l'identité de la parcelle, la réussite de la mission, les octets et SHA-256 téléchargés puis sonde le fichier réel avec ffprobe. Le chemin Mistral historique est conservé et exige désormais un décodage complet avant de déclarer l'image générée.

Publisher réutilise son producteur Mistral existant pour le texte et les images, uniquement lorsque la permission correspondante est explicite. Un média enregistré et un script préparé permettent un parcours entièrement local gratuit : Piper français, musique/bruitages originaux CC0, mixage avec ducking, normalisation, animation FFmpeg et sous-titres par phrase mesurée. Canva et ElevenLabs ne sont pas supposés utilisables sur la seule base d'une connexion ; aucune consommation de crédit n'est déclenchée pour les tester.

## Commander une production

Exemple complet, distinct de l'état réel du jardin : `examples/studio/420-dice.seed.json`. Aucune seed réelle n'a été modifiée ou activée. Les paramètres ne contiennent aucun produit codé dans les moteurs : une autre parcelle fournit ses propres `assetId`, titre court, phrases et provenance.

Avec Publisher et Octopus locaux démarrés, le nouvel adaptateur déclaré et le moteur vocal installé côté Publisher :

```sh
node scripts/gerard-av-studio.mjs examples/studio/420-dice.seed.json video demonstration-420 ./media-review/420-dice
```

Le client appelle `/mission`, pas un service de publication. Les wrappers `gerard-audio-studio.mjs` et `gerard-video-studio.mjs` réutilisent ce même client. `runImageStudio` accepte le même adaptateur de soumission. Les ressources `mistral.text` et `mistral.image` sont absentes par défaut ; les options `allowMistralText`/`allowMistralImage` sont des décisions explicites supplémentaires.

Le cycle existant reconnaît une seed dotée d'un template audio/video même sans fiche Notion, si elle possède un script et des médias valides. Il exige `GERARD_AV_STUDIO_ENABLED=true`, désactivé par défaut. L'ancien interrupteur image conserve son périmètre d'autorisation Mistral. Les dépendances locales ne sont installées dans le workflow existant que si un studio est activé. Aucun nouveau déclencheur ni cron : `17 */3 * * *` reste inchangé.

Une configuration inchangée conserve le même identifiant de production. Une archive vérifiée est réutilisée au cycle suivant sans nouvel appel d'Octopus ; modifier le texte/template crée une nouvelle production. Les fichiers et rapports dans `garden/studio/` sont conservés par le mécanisme existant de commit d'état et dans son artefact de diagnostic. Ils ne sont pas ajoutés aux récoltes publiables, aux files sociales ou au dossier public du site. Aucun lien de publication n'est inventé.

## Vérification effectuée

- 135 tests Poulpe réussis, dont quatre nouveaux tests de missions neutres, autorisations, archive, hash, mauvaise parcelle et réutilisation sans nouveau rendu.
- Parcours HTTP réel local : client de cette branche → Octopus compilé existant → vraie route Express Publisher → Piper + FFmpeg → téléchargement MP4 et archive. Tous les accès externes sont interdits par le test ; aucun moteur n'est simulé pour le rendu. Répétition idempotente et fichier altéré contrôlés.
- Démonstration 420 Dice réelle : 18 secondes, 1080 × 1920, 30 images/s, H.264/yuv420p, audio AAC stéréo 48 kHz, six sous-titres synchronisés. Rapport et MP4 livrés dans la PR Publisher compagnon, avec crédits SIWIS CC-BY 4.0 et média officiel utilisé seulement pour la démonstration autorisée.
- Les tests unitaires de Mistral utilisent des réponses simulées clairement identifiées ; aucune réussite de génération Mistral, Canva ou ElevenLabs réelle n'est revendiquée pour cette mission.

## Limites et mise en service

L'autonomie technique fonctionne pour une parcelle configurée avec ses médias et droits. Cela ne signifie pas que toutes les parcelles disposent déjà de ces entrées. Les images distantes arbitraires ne sont pas acceptées : un administrateur enregistre un média/hachage/droits dans le catalogue Publisher, ou Gérard autorise le producteur Mistral déjà existant. Aucune clé n'est demandée dans une seed.

Le rendu FFmpeg/Piper requiert le runtime Node local ; il ne tourne pas dans Cloudflare Workers. Le code est livré en PR, sans déploiement ni fusion. L'activation du cycle AV et la validation des droits de diffusion restent des décisions distinctes. Le sous-titrage est synchronisé par phrase, pas mot à mot ; l'animation est un mouvement d'image, pas une preuve de nouveau gameplay. Les contrôles techniques ne remplacent pas la revue créative et l'écoute humaine.

Aucun abonnement, connexion, secret, budget, publication programmée, canal social ou déclencheur de publication n'a été changé. Aucune publication envoyée. Coût externe constaté de la démonstration : zéro appel payant ; coût de calcul local non mesuré.
