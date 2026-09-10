#!/usr/bin/env python3
"""Tighten a generated asset's framing: crop to the drawing, keep the canvas size.

A generated illustration usually arrives with uneven baked-in cream. Measured on
the shipped assets, `empty-journal.jpg` used 73% x 61% of its square with a 24%
dead band underneath, so inside its bordered layout box it read as a small mark
floating in empty space rather than a framed picture.

This finds the drawing's bounding box, centres it inside a crop of the SAME
aspect ratio as the original (so no declared width/height has to change
anywhere), adds a uniform margin, and scales back up to the original pixel size.
The ground is re-snapped at the end, because rescaling resamples flat cream.

    scripts/brand/tighten-frame.py --check                 # report only
    scripts/brand/tighten-frame.py public/brand/foo.jpg    # rewrite in place
    scripts/brand/tighten-frame.py --margin 0.14 <files...>
"""
import argparse
import collections
import sys
from pathlib import Path
from typing import Any, cast

from PIL import Image

CANVAS = (0xFB, 0xF4, 0xE6)
ART_TOL = 26      # how far from the ground counts as "drawing"
SNAP_TOL = 10     # ground-snap tolerance, matching snap-ground.py
LANCZOS = Image.Resampling.LANCZOS


def hexof(rgb):
    return "#%02x%02x%02x" % tuple(rgb[:3])


def delta(a, b):
    return max(abs(a[i] - b[i]) for i in range(3))


def art_bbox(img):
    w, h = img.size
    px = cast(Any, img.load())

    def has(x, y):
        p = px[x, y]
        return max(abs(p[i] - CANVAS[i]) for i in range(3)) > ART_TOL

    xs = [x for x in range(0, w, 2) if any(has(x, y) for y in range(0, h, 6))]
    ys = [y for y in range(0, h, 2) if any(has(x, y) for x in range(0, w, 6))]
    if not xs or not ys:
        return None
    # Full-resolution edges, stepped in from the sampled ones.
    return (max(0, min(xs) - 2), max(0, min(ys) - 2),
            min(w, max(xs) + 3), min(h, max(ys) + 3))


def snap(img, tolerance=SNAP_TOL):
    ground = collections.Counter(cast(Any, img.getdata())).most_common(1)[0][0]
    before = delta(ground, CANVAS)
    if before == 0:
        return img, 0
    px = cast(Any, img.load())
    w, h = img.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if max(abs(p[i] - ground[i]) for i in range(3)) <= tolerance:
                px[x, y] = CANVAS
    return img, before


def tighten(img, margin):
    """Centre the drawing in a same-aspect crop, then scale back to size."""
    w, h = img.size
    box = art_bbox(img)
    if box is None:
        return img, None
    x0, y0, x1, y1 = box
    aw, ah = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    aspect = w / h

    # Smallest same-aspect crop that holds the drawing with `margin` all round.
    need_w = aw / (1 - margin * 2)
    need_h = ah / (1 - margin * 2)
    crop_w = max(need_w, need_h * aspect)
    crop_h = crop_w / aspect
    if crop_w > w:                      # the drawing already fills the frame
        crop_w, crop_h = w, h
    left = min(max(0, round(cx - crop_w / 2)), w - round(crop_w))
    top = min(max(0, round(cy - crop_h / 2)), h - round(crop_h))
    cropped = img.crop((left, top, left + round(crop_w), top + round(crop_h)))
    return cropped.resize((w, h), LANCZOS), (crop_w / w)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--margin", type=float, default=0.12)
    ap.add_argument("--glob", default=None, help="e.g. 'public/brand/*.jpg'")
    args = ap.parse_args()

    files = list(args.files)
    if args.glob:
        files += [str(p) for p in sorted(Path().glob(args.glob))]
    if not files:
        sys.exit("nothing to do: pass files or --glob")

    print(f'{"asset":34s} {"before":11s} {"after":11s} {"zoom":6s} ground')
    print("-" * 84)
    for f in files:
        p = Path(f)
        if not p.exists():
            print(f"{f:34s} MISSING")
            continue
        img = Image.open(p).convert("RGB")
        w, h = img.size
        b0 = art_bbox(img)
        before = f"{(b0[2]-b0[0])/w*100:.0f}%x{(b0[3]-b0[1])/h*100:.0f}%" if b0 else "-"

        tightened, zoom = tighten(img, args.margin)
        if zoom is None:
            print(f"{f:34s} {before:11s} no drawing found (all ground)")
            continue
        b1 = art_bbox(tightened)
        after = f"{(b1[2]-b1[0])/w*100:.0f}%x{(b1[3]-b1[1])/h*100:.0f}%" if b1 else "?"

        if args.check:
            print(f"{p.name:34s} {before:11s} {after:11s} {zoom:5.2f}x (check, not written)")
            continue

        final, snapped = snap(tightened)
        final.save(p, "JPEG", quality=95, subsampling=0, optimize=True)
        note = f"snapped {snapped}" if snapped else "already exact"
        print(f"{p.name:34s} {before:11s} {after:11s} {zoom:5.2f}x {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
