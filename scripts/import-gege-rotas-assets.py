#!/usr/bin/env python3
"""Import the generated Rotas-inspired Jardin des Gégé asset bundle.
Usage: python3 scripts/import-gege-rotas-assets.py jardin_gege_rotas_assets.zip
Writes only to src/jardin-gege-lovable/public/assets/gege-rotas.
No changes to the live scene, agent states or scheduled workflows.
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

DEST = Path("src/jardin-gege-lovable/public/assets/gege-rotas")
FRAME_NAMES = ("gerard", "cueilleur", "batisseur", "alchimiste", "passeur", "jardinier", "mineur", "archiviste")

def main(archive):
    with zipfile.ZipFile(archive) as bundle:
        manifest = json.loads(bundle.read("manifest.json"))
        groups = manifest["characters"]
        if tuple(groups) != FRAME_NAMES:
            raise ValueError("Unexpected sprite groups or order")
        expected = [name for names in groups.values() for name in names]
        if len(expected) != 98 or len(set(expected)) != 98:
            raise ValueError("Expected 98 unique sprite frames")
        requested = ["background.png", "background.webp", "sprite-sheet-source.png"] + ["frames/" + n for n in expected]
        hashes = manifest["sha256"]
        for name in requested:
            if name not in hashes:
                raise ValueError("Missing checksum: " + name)
            contents = bundle.read(name)
            if hashlib.sha256(contents).hexdigest() != hashes[name]:
                raise ValueError("SHA-256 mismatch: " + name)
            if name.endswith(".png") and not contents.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("Invalid PNG: " + name)
            target = DEST / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contents)
        (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported 98 PNG character frames and 3 source/background files to {DEST}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/import-gege-rotas-assets.py <assets.zip>")
    main(sys.argv[1])
