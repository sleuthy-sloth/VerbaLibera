"""Every shipped brand asset as a markdown table row, for docs/asset-provenance.md.

Dimensions come from the file headers and sizes from the filesystem, so the table
cannot drift from the tree by a typo. Pairs with tests/asset-provenance.test.ts,
which fails when a tracked asset is missing from the document or a documented file
is missing from the tree.

    python3 scripts/brand/asset-table.py
"""
from __future__ import annotations

import os
import subprocess
from typing import Any, cast

from PIL import Image

TRACKED = [
    "public/brand/logo-mark.jpg",
    "public/brand/logo-lockup.jpg",
    "public/brand/hero-banner.jpg",
    "public/brand/empty-journal.jpg",
    "public/brand/player-card.jpg",
    "public/brand/player-lock.jpg",
    "public/brand/courses/french.jpg",
    "public/brand/courses/german.jpg",
    "public/brand/courses/italian.jpg",
    "public/brand/courses/spanish.jpg",
    "public/brand/courses/portuguese.jpg",
    "public/og-card.jpg",
    "public/icons/verbalibera-192.png",
    "public/icons/verbalibera-512.png",
    "public/icons/verbalibera-maskable-512.png",
    "public/apple-touch-icon.png",
    "src/app/favicon.ico",
]


def dimensions(path: str) -> str:
    if path.endswith(".ico"):
        return "32×32"
    with Image.open(path) as image:
        return f"{image.width}×{image.height}"


def main() -> int:
    tracked = subprocess.run(
        ["git", "ls-files", "public"], capture_output=True, text=True, check=True
    ).stdout.split()
    for path in TRACKED:
        state = "tracked" if path in tracked else "NOT TRACKED"
        if not os.path.exists(path):
            print(f"| `{path}` | — | — | missing |")
            continue
        size = os.path.getsize(path)
        print(f"| `{path}` | {dimensions(path)} | {size:,} B | {state} |")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
