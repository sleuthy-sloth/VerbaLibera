#!/usr/bin/env python3
"""Snap the flat ground of a generated asset to the app's exact canvas colour.

Image models approximate hex values. Measured from the real generated files:
ink and accent come back essentially exact (#2f2b22 vs #2f2a24, #a2521f vs
#a8511f) but the cream ground drifts -- most on the logo mark, which renders as
a 32x32 tile sitting directly ON the cream header, where the drift reads as a
faint square.

The ground is a flat field, so a tight-tolerance remap is safe and deterministic:
every pixel within TOLERANCE of the sampled ground becomes exactly #fbf4e6.
Interior cream fills of the same tone shift with it, which keeps the artwork
coherent -- it does not selectively punch holes.

    scripts/brand/snap-ground.py --check  <files...>   # report only
    scripts/brand/snap-ground.py          <files...>   # rewrite in place
    scripts/brand/snap-ground.py -o out.png <file>

Exit code is 1 if --check finds any file whose ground is off, so it can gate CI.
"""
import argparse
import collections
import sys
from pathlib import Path
from typing import Any, cast

from PIL import Image

CANVAS = (0xFB, 0xF4, 0xE6)
# Tight on purpose. The largest genuine mismatch measured was 13 in one channel;
# the nearest legitimate illustration fill (an off-white laundry) sits ~14 away,
# so a window this size reaches the ground without swallowing the art.
TOLERANCE = 10


def hexof(rgb):
    return "#%02x%02x%02x" % tuple(rgb[:3])


def delta(a, b):
    return max(abs(a[i] - b[i]) for i in range(3))


def load_rgb(path):
    img = Image.open(path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def modal_ground(img):
    """The ground is the single most common colour in a flat illustration."""
    return collections.Counter(img.getdata()).most_common(1)[0][0]


def snap(path, out_path=None, tolerance=TOLERANCE):
    img = load_rgb(path)
    ground = modal_ground(img)
    before = delta(ground, CANVAS)

    if before == 0:
        return {"path": str(path), "before": 0, "after": 0, "changed": 0, "skipped": True}

    w, h = img.size
    px = cast(Any, img.load())
    changed = 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if max(abs(p[i] - ground[i]) for i in range(3)) <= tolerance:
                px[x, y] = CANVAS
                changed += 1

    dest = Path(out_path) if out_path else Path(path)
    # Preserve JPEG for the assets the app serves as .jpg, PNG for the rest.
    if dest.suffix.lower() in (".jpg", ".jpeg"):
        img.save(dest, "JPEG", quality=95, subsampling=0, optimize=True)
    else:
        img.save(dest, "PNG", optimize=True)

    # Verify the array we actually controlled, then report what the encoder did
    # to it. Re-encoding a JPEG perturbs flat fields by about one unit per
    # channel -- unavoidable and invisible, so it must not read as a failure.
    in_memory = delta(modal_ground(img), CANVAS)
    on_disk = delta(modal_ground(load_rgb(dest)), CANVAS)
    return {
        "path": str(dest),
        "before": before,
        "in_memory": in_memory,
        "after": on_disk,
        "changed": changed,
        "total": w * h,
        "skipped": False,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    ap.add_argument("-o", "--out", help="write here instead of in place (single file only)")
    ap.add_argument("--tolerance", type=int, default=TOLERANCE)
    args = ap.parse_args()

    if args.out and len(args.files) > 1:
        sys.exit("error: -o takes exactly one input file")

    off = []
    for f in args.files:
        p = Path(f)
        if not p.exists():
            print(f"  MISSING  {f}")
            off.append(f)
            continue
        img = load_rgb(p)
        ground = modal_ground(img)
        d = delta(ground, CANVAS)

        if args.check:
            # A JPEG that has already been snapped reads back ~1 unit off purely
            # from its own encoding, so only a real mismatch fails the gate.
            ok = d <= 1
            tag = "exact" if d == 0 else ("exact (jpeg rounding)" if ok else f"off by {d}")
            print(f"  {'OK ' if ok else 'BAD'}  {p.name:34s} ground {hexof(ground)}  {tag}")
            if not ok:
                off.append(str(p))
            continue

        r = snap(p, args.out, args.tolerance)
        if r["skipped"]:
            print(f"  {p.name:34s} already exact, untouched")
        else:
            pct = r["changed"] / r["total"] * 100
            print(
                f"  {p.name:34s} {r['before']:>3} -> {r['after']:>3}  "
                f"remapped {r['changed']:,}/{r['total']:,} px ({pct:.1f}%)"
            )
            # in_memory must be perfect; on_disk may carry the encoder's +/-1.
            if r["in_memory"] != 0 or r["after"] > 1:
                off.append(str(p))

    if args.check and off:
        print(f"\n{len(off)} file(s) have a ground that does not match the canvas (#fbf4e6).")
        return 1
    if not args.check and off:
        print(f"\nWARNING: {len(off)} file(s) still not exact after snapping.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
