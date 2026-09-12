"""Compare every shipped brand asset against the approved reference in ~/Downloads.

Answers one question per asset: is the file in the tree the approved artwork, and
is it framed the way the reference is? A horizontal shift search distinguishes
"the same picture, re-encoded" (best shift 0, low residual) from "the same
picture, moved inside the frame" (best shift != 0, low residual at that shift)
from "not the same picture" (high residual everywhere).

    python3 scripts/brand/compare-reference.py            # framing comparison
    python3 scripts/brand/compare-reference.py --crops    # also: the crop each
                                                          # file would need

The `--crops` column exists because the shipped file is what the stylesheet
measures against: a re-framed asset and its reference do not need the same
narrow-viewport window, and printing both keeps the consequence of a re-frame
visible instead of implied.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from typing import Any, cast

from PIL import Image

# The crop rule lives in banner-crops.py, whose hyphenated name is not
# importable, so it is loaded by path rather than renamed (the design brief and
# tests/banner-crops.test.ts call it by that name).
_spec = importlib.util.spec_from_file_location(
    "banner_crops",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "banner-crops.py"),
)
banner_crops = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(banner_crops)
derive = banner_crops.derive

WORK = 512  # comparison width; the shift search runs at this size
MAX_SHIFT = 96  # working pixels, so ~19% of the frame at 512

PAIRS = [
    ("public/brand/courses/french.jpg", "Course Banner French.jpeg"),
    ("public/brand/courses/german.jpg", "Course Banner German.jpeg"),
    ("public/brand/courses/italian.jpg", "Course Banner Italian.jpeg"),
    ("public/brand/courses/spanish.jpg", "Course Banner Spanish.jpeg"),
    ("public/brand/courses/portuguese.jpg", "Course Banner Portugal.jpeg"),
    ("public/brand/hero-banner.jpg", "Hero Banner.jpeg"),
    ("public/brand/empty-journal.jpg", "Empty Journal.jpeg"),
    ("public/brand/logo-lockup.jpg", "Logo Lockup.jpeg"),
    ("public/brand/logo-mark.jpg", "Logo Mark.jpeg"),
    ("public/og-card.jpg", "Social Card.jpeg"),
]


def load(path: str) -> Image.Image:
    return Image.open(path).convert("RGB")


def grey(image: Image.Image, width: int = WORK) -> tuple[list[float], int]:
    height = max(1, round(image.height * width / image.width))
    resampling = getattr(Image, "Resampling", Image)
    small = image.resize((width, height), resampling.LANCZOS).convert("L")
    pixels = cast(Any, small.load())
    return [pixels[x, y] for y in range(height) for x in range(width)], height


def shift_score(a: list[float], b: list[float], width: int, height: int, dx: int) -> float:
    """Mean absolute difference over the overlap when b is moved by dx."""
    total = 0.0
    count = 0
    for y in range(0, height, 2):
        row = y * width
        for x in range(0, width, 2):
            sx = x + dx
            if sx < 0 or sx >= width:
                continue
            total += abs(a[row + x] - b[row + sx])
            count += 1
    return total / count if count else 255.0


def compare(shipped_path: str, reference_path: str) -> dict[str, Any]:
    """Framing comparison between one shipped asset and its reference."""
    shipped = load(shipped_path)
    reference = load(reference_path)
    out: dict[str, Any] = {
        "shipped": f"{shipped.width}x{shipped.height}",
        "reference": f"{reference.width}x{reference.height}",
        "shipped_bytes": os.path.getsize(shipped_path),
        "reference_bytes": os.path.getsize(reference_path),
    }
    if round(shipped.width / shipped.height, 3) != round(reference.width / reference.height, 3):
        out["aspect"] = "DIFFERS"
    # Both go through the same working width, so a differing aspect is squashed
    # rather than hidden; the aspect column says when that is the case.
    a, height = grey(shipped)
    b, _ = grey(reference)
    width = WORK
    out["at_rest"] = round(shift_score(a, b, width, height, 0), 2)
    best = min(
        ((dx, shift_score(a, b, width, height, dx)) for dx in range(-MAX_SHIFT, MAX_SHIFT + 1)),
        key=lambda pair: pair[1],
    )
    out["best_shift_px_at_512"] = best[0]
    out["best_shift_px_at_full"] = round(best[0] * shipped.width / width)
    out["best_score"] = round(best[1], 2)
    return out


def crop_pair(shipped_path: str, reference_path: str) -> str:
    """What each file would need if the mobile crop rule were applied to it."""
    shipped = derive(shipped_path)
    reference = derive(reference_path)
    return (
        f"crop: shipped {shipped['cropAspect']:.2f} @ {shipped['focusX']:.1f}%"
        f"  |  reference {reference['cropAspect']:.2f} @ {reference['focusX']:.1f}%"
    )


def main() -> int:
    with_crops = "--crops" in sys.argv
    downloads = os.path.expanduser("~/Downloads")
    print(f"{'shipped asset':34s} {'shipped':11s} {'reference':11s} {'at rest':8s} {'best shift':11s} {'best'}")
    print("-" * 100)
    for shipped, reference_name in PAIRS:
        reference = os.path.join(downloads, reference_name)
        if not os.path.exists(shipped):
            print(f"{shipped:34s} MISSING")
            continue
        if not os.path.exists(reference):
            print(f"{shipped:34s} no reference {reference_name}")
            continue
        result = compare(shipped, reference)
        aspect = " *aspect differs*" if result.get("aspect") == "DIFFERS" else ""
        print(
            f"{shipped.replace('public/', ''):34s} {result['shipped']:11s} {result['reference']:11s} "
            f"{result['at_rest']:8.2f} {result['best_shift_px_at_full']:11d} {result['best_score']:8.2f}{aspect}"
        )
        if with_crops and "courses/" in shipped:
            print(f"{' ' * 34} {crop_pair(shipped, reference)}")
    print()
    print("'at rest' is the mean grey difference with no shift; 'best shift' is the horizontal")
    print("offset (in full-resolution pixels) that minimises it. Same picture, same framing:")
    print("shift 0 and a small score. Same picture, moved: a non-zero shift that beats it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
