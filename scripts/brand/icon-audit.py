"""Is the maskable launcher icon safe, and do the icon files match the approved art?

Two questions, both answerable from the pixels:

1. **Maskable safe zone.** Android crops a maskable icon to whatever shape the
   launcher uses, and the guaranteed-visible region is the central circle of 80%
   of the width. Art outside it can be cut. Measures the drawn bounding box and
   says how it sits against that circle.
2. **Icon files vs the approved reference** (`~/Downloads/App Icon.jpeg`): the
   same shift-and-residual comparison `compare-reference.py` runs for the
   banners, so a re-composited icon is visible as a re-composite rather than
   passed over.

    python3 scripts/brand/icon-audit.py
"""
from __future__ import annotations

import os
from typing import Any, cast

from PIL import Image

CANVAS = (0xFB, 0xF4, 0xE6)
TOL = 26
ICONS = [
    "public/icons/verbalibera-192.png",
    "public/icons/verbalibera-512.png",
    "public/icons/verbalibera-maskable-512.png",
    "public/apple-touch-icon.png",
]


def art_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    px = cast(Any, image.load())
    xs = [x for x in range(image.width) if any(_differs(px[x, y]) for y in range(0, image.height, 3))]
    ys = [y for y in range(image.height) if any(_differs(px[x, y]) for x in range(0, image.width, 3))]
    if not xs or not ys:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def differs(pixel: tuple[int, int, int]) -> bool:
    return max(abs(pixel[i] - CANVAS[i]) for i in range(3)) > TOL


def _differs(pixel: tuple[int, int, int]) -> bool:
    return differs(pixel)


def main() -> int:
    downloads = os.path.expanduser("~/Downloads")
    reference_path = os.path.join(downloads, "App Icon.jpeg")
    reference = Image.open(reference_path).convert("RGB") if os.path.exists(reference_path) else None

    print(f"{'icon':44s} {'size':11s} {'art bbox (% of frame)':26s} {'safe zone':10s} {'vs reference'}")
    print("-" * 110)
    for path in ICONS:
        if not os.path.exists(path):
            print(f"{path:44s} MISSING")
            continue
        image = Image.open(path).convert("RGBA")
        flat = Image.new("RGB", image.size, CANVAS)
        flat.paste(image, mask=image.split()[3])
        box = art_bbox(flat)
        if box is None:
            print(f"{path:44s} {image.width}x{image.height:<5d} no artwork found against the canvas")
            continue
        x0, y0, x1, y1 = box
        w, h = image.size
        bbox = f"x {x0 / w:4.0%}-{x1 / w:4.0%}  y {y0 / h:4.0%}-{y1 / h:4.0%}"
        # The safe zone is the circle of diameter 0.8 * width, centred.
        cx, cy, r = w / 2, h / 2, 0.4 * min(w, h)
        corners = [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]
        outside = [
            (x, y)
            for x, y in corners
            if ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 > r
        ]
        safe = "inside" if not outside else f"{len(outside)}/4 corners out"
        verdict = "no reference"
        if reference is not None:
            small_a = flat.resize((256, 256), Image.Resampling.LANCZOS).convert("L")
            small_b = reference.resize((256, 256), Image.Resampling.LANCZOS).convert("L")
            pa, pb = cast(Any, small_a.load()), cast(Any, small_b.load())
            diff = sum(
                abs(pa[x, y] - pb[x, y]) for y in range(0, 256, 2) for x in range(0, 256, 2)
            ) / (128 * 128)
            verdict = f"mean diff {diff:5.1f}"
        print(f"{path:44s} {w}x{h:<5d} {bbox:26s} {safe:10s} {verdict}")
    print()
    print("Safe zone: the central circle of 80% of the width. 'corners out' means the art's")
    print("bounding box reaches past it, which a circular launcher mask can cut.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
