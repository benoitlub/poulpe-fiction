# Prérequis image dans la CI

Le run 42642217255 du 9 novembre 2026 échoue sur
`generated file is recovered and decoded; interrupted retrieval does not generate again`
avec `spawn ffmpeg ENOENT` : 189 tests réussissent et un test manque du binaire.
Ce n’est pas un échec d’appel Mistral ; ce test crée une fixture locale.

Le workflow Validate existant prépare désormais FFmpeg et ffprobe avant les tests.
Le test de décodage et ses assertions restent inchangés. Aucun cron, workflow de
production, compte, secret, budget ou média programmé n’est modifié. Aucune
génération Mistral, publication, fusion ou déploiement n’est lancé.
