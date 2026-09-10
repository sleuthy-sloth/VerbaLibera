#!/usr/bin/env python3
"""Install generated brand art into public/, snapped and at the right size.

Image models return whatever aspect ratio they feel like, and the ground cream
always drifts. This maps each generated file to its destination with the exact
geometry the app expects, then snaps the ground (see snap-ground.py).

    scripts/brand/install-generated.py --check      # report, write nothing
    scripts/brand/install-generated.py              # install
    scripts/brand/install-generated.py --src ~/Downloads
"""
import argparse
import collections
import os
import sys
from pathlib import Path
from typing import Any, cast

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CANVAS = (0xFB, 0xF4, 0xE6)
TOLERANCE = 10
LANCZOS = Image.Resampling.LANCZOS

# (source filename, destination under public/, target width, target height)
# 'crop' sources are centre-cropped to the target aspect first; everything else
# must already match, because a silent rescale is how a banner ends up squashed.
MANIFEST = [
    ("Logo Mark.jpeg",       "brand/logo-mark.jpg",        1024, 1024, "exact"),
    ("Logo Lockup.jpeg",     "brand/logo-lockup.jpg",      1792,  592, "exact"),
    ("Hero Banner.jpeg",     "brand/hero-banner.jpg",      1584,  672, "exact"),
    ("Empty Journal.jpeg",   "brand/empty-journal.jpg",    1024, 1024, "exact"),
    ("Social Card.jpeg",     "og-card.jpg",                1200,  630, "crop"),
    ("Course Banner French.jpeg",   "brand/courses/french.jpg",     2064, 512, "exact"),
    ("Course Banner Italian.jpeg",  "brand/courses/italian.jpg",    2064, 512, "exact"),
    ("Course Banner Spanish.jpeg",  "brand/courses/spanish.jpg",    2064, 512, "exact"),
    ("Course Banner Portugal.jpeg", "brand/courses/portuguese.jpg", 2064, 512, "exact"),
    ("Course Banner German.jpeg",   "brand/courses/german.jpg",     2064, 512, "exact"),
]


def hexof(rgb):
    return "#%02x%02x%02x" % tuple(rgb[:3])


def delta(a, b):
    return max(abs(a[i] - b[i]) for i in range(3))


def snap(img, tolerance=TOLERANCE):
    """Remap the flat ground to exactly the canvas colour. Returns (img, before, changed)."""
    ground = collections.Counter(cast(Any, img.getdata())).most_common(1)[0][0]
    before = delta(ground, CANVAS)
    if before == 0:
        return img, 0, 0

    px = cast(Any, img.load())
    w, h = img.size
    changed = 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if max(abs(p[i] - ground[i]) for i in range(3)) <= tolerance:
                px[x, y] = CANVAS
                changed += 1
    return img, before, changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.expanduser("~/Downloads"))
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    src_dir = Path(args.src)
    problems = []

    print(f'{"source":30s} {"size":12s} {"-> target":12s} {"ground":8s} action')
    print("-" * 88)

    for name, dest_rel, tw, th, mode in MANIFEST:
        src = src_dir / name
        dest = ROOT / "public" / dest_rel

        if not src.exists():
            print(f"{name:30s} {'MISSING':12s}")
            problems.append(f"{name}: not found in {src_dir}")
            continue

        img = Image.open(src).convert("RGB")
        w, h = img.size
        ground = collections.Counter(cast(Any, img.getdata())).most_common(1)[0][0]
        off = delta(ground, CANVAS)

        note = ""
        if (w, h) != (tw, th):
            if mode == "crop":
                keep_h = round(w / (tw / th))
                if keep_h > h:
                    problems.append(f"{name}: cannot crop {w}x{h} to {tw}x{th}")
                    continue
                top = (h - keep_h) // 2
                img = img.crop((0, top, w, top + keep_h)).resize((tw, th), LANCZOS)
                note = f"cropped {h - keep_h}px of height"
            else:
                # Refuse to guess. A wrong-ratio asset that gets silently
                # rescaled is how a wide banner ends up a squashed square.
                problems.append(
                    f"{name}: is {w}x{h}, needs {tw}x{th} — regenerate at the right aspect ratio"
                )
                print(f"{name:30s} {w}x{h:<7d} {tw}x{th:<7d} {hexof(ground):8s} REJECTED")
                continue
        img = img.resize((tw, th), LANCZOS)

        snapped, before, changed = snap(img)
        parts = []
        if note:
            parts.append(note)
        if before:
            pct = changed / (tw * th) * 100
            parts.append(f"ground {before} -> 0 ({pct:.0f}% of frame)")
        else:
            parts.append("ground already exact")
        note = "; ".join(parts)

        if args.check:
            action = "would write" if before else "already exact"
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            snapped.save(dest, "JPEG", quality=95, subsampling=0, optimize=True)
            action = "wrote"

        print(f"{name:30s} {w}x{h:<7d} {tw}x{th:<7d} {hexof(ground):8s} {action} {note}")

    if args.check:
        print("\n--check: nothing written.")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
