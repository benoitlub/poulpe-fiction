# Jardin des Gégé — ressources diorama Rotas

This branch stages the **binary import pipeline** for the assets generated in ChatGPT.

The actual PNG/WebP binaries **are not committed yet**. The GitHub connector supports text commits and binary blobs from supplied Base64, but cannot directly read the generated local attachment. Do not merge expecting pictures to appear in the garden.

## Asset bundle
Filename: `jardin_gege_rotas_assets.zip` (~8 MB).

Contains:
- `background.png`: cinematic empty central lagoon (no Gérard)
- `background.webp`: optimized browser background
- `sprite-sheet-source.png`: reference source sheet
- `frames/gerard_01.png`–`gerard_14.png`
- Seven other character sets, 12 RGBA PNGs each (98 frames total)
- `manifest.json` with every filename and SHA-256 for integrity

## Import, after ZIP has been downloaded
```bash
python3 scripts/import-gege-rotas-assets.py jardin_gege_rotas_assets.zip
git add src/jardin-gege-lovable/public/assets/gege-rotas/
git commit -m "Add Jardin des Gégé Rotas background and animation PNG assets"
```

The importer verifies the complete archive before extracting files into the existing Lovable application's public assets. **Nothing is wired into the scene yet.** The sprites are generated pose references, not a validated frame-perfect walk cycle. Transparency has been approximated from a light backdrop and needs a visual review before production.

Do not add duplicate characters over the current SVG Gégé. Replace the existing visuals during a separate UI PR after approval.
