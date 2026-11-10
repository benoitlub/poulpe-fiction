#!/usr/bin/env python3
"""Import already uploaded PNG/WebP assets into the Lovable public directory.

Usage: python3 scripts/import-gege-rotas-assets.py [assets-import]
The GitHub upload placed individual images directly in assets-import/, not a ZIP.
"""
import json
import shutil
import sys
from pathlib import Path

DEST = Path("src/jardin-gege-lovable/public/assets/gege-rotas")
GROUPS = {
    "gerard": 14,
    "cueilleur": 12,
    "batisseur": 12,
    "alchimiste": 12,
    "passeur": 12,
    "jardinier": 12,
    "mineur": 12,
    "archiviste": 12,
}
EXTRAS = ("background.png", "background.webp", "sprite-sheet-source.png")

def main(source):
    source = Path(source)
    names = [f"{group}_{i:02d}.png" for group, count in GROUPS.items()
             for i in range(1, count + 1)]
    names += list(EXTRAS)
    missing = [name for name in names if not (source / name).is_file()]
    if missing:
        raise ValueError("Missing assets: " + ", ".join(missing))
    for name in names:
        data = (source / name).read_bytes()
        if name.endswith(".png") and not data.startswith(b"\\x89PNG\\r\\n\\x1a\\n"):
            raise ValueError(f"Invalid PNG: {name}")
        if name.endswith(".webp") and not (data[:4] == b"RIFF" and data[8:12] == b"WEBP"):
            raise ValueError(f"Invalid WebP: {name}")
    DEST.mkdir(parents=True, exist_ok=True)
    for name in names:
        shutil.copyfile(source / name, DEST / name)
    manifest = {
        "characters": {
            group: [f"{group}_{i:02d}.png" for i in range(1, count + 1)]
            for group, count in GROUPS.items()
        },
        "background": "background.webp",
        "sourceSheet": "sprite-sheet-source.png",
        "frameCount": 98,
    }
    (DEST / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Imported {len(names)} image assets into {DEST}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "assets-import")
