# Capture de gameplay réel — 420 Dice (pilote)

## Objectif
Fournir au studio audiovisuel existant une **vraie source animée** (et non un zoom sur une capture fixe). Premier jeu autorisé : [420 Dice Game Reboot](https://benoitlub.github.io/420-dice-game-reboot/).

## Exécution
Le workflow existant **Gerard Reel 420 visual proof** comporte maintenant l'entrée manuelle `capture_live_gameplay=true`. Il installe Chromium/Playwright et FFmpeg sur le runner GitHub, ouvre la version publique du jeu, désactive l'écran d'accueil, puis déclenche jusqu'à trois véritables lancers. Les boutons et dés sont vérifiés avec les attributs `data-testid` du jeu réel.

Artefact : `gerard-420-real-gameplay-<run_id>` avec :
- `gameplay-source.webm` — captation navigateur brute ;
- `gameplay-vertical.mp4` — clip 1080×1920 H.264 **silencieux**, prêt à être intégré en montage ;
- `final-frame.png` — image de référence ;
- `review-report.json` — provenance, SHA-256, nombre de lancers, faces observées, frames distinctes, jugement technique et `creativeQuality: human-review-required`.

La capture bloque les POST et les sous-requêtes vers d'autres domaines ; les défis en ligne externes ne sont pas appelés. Les données produites ne sont ni envoyées à Publisher ni publiées automatiquement. Pas de consommateur IA, d'API payante ou de clé nouvelle.

## Limites honnêtes
- Le test de mouvement détecte les images distinctes et les véritables interactions, **pas** le caractère captivant du Short.
- La source vidéo n'est pas encore incorporée dans `video.studio` de Publisher : celui-ci utilise aujourd'hui `image.png` comme entrée. L'étape suivante consiste à enregistrer le MP4 dans le catalogue de médias Publisher avec hash, parcelle et droits validés, puis à ajouter une entrée `videoAssetId` pour remplacer le zoom. Aucun chemin arbitraire ni URL externe ne doit être accepté.
- Ce pilote ne produit pas encore la voix Piper ni la musique dans le même MP4 ; le montage sonore déjà démontré par Publisher reste un maillon distinct.
- Une réussite technique ne vaut pas validation éditoriale. Pas de réseau social ni d'envoi automatique.

## Vérifications
`node --test tests/gerard-gameplay-capture.test.mjs` vérifie la provenance, la réalité des interactions, l'animation constatée, le format vertical et le contrôle de mouvement.
