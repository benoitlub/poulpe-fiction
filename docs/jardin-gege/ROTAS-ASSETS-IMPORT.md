# Jardin des Gégé — ressources Rotas

Les 98 images de personnages et les trois images du décor ont été importées dans :
`src/jardin-gege-lovable/public/assets/gege-rotas/`.

Le manifeste `manifest.json` décrit les groupes et les noms de fichiers :
- Gérard : 14 PNG
- Sept métiers : 12 PNG par métier
- `background.png`, `background.webp`, `sprite-sheet-source.png`

Les fichiers originaux envoyés depuis le téléphone restent temporairement dans `assets-import/`. Ils ne doivent **pas** être chargés par l'application : seul le dossier public final est utilisé.

L'importateur `scripts/import-gege-rotas-assets.py` vérifie les signatures et la présence des 101 images avant copie. Il ne modifie pas la scène.

**À faire séparément :** intégrer les sprites à la place des SVG existants (sans doublons), tester le défilement, la réduction des animations et les performances mobiles. Les PNG sont des poses générées, pas encore un cycle de marche validé.
