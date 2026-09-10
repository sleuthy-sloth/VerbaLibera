#!/usr/bin/env bash
# Turn one generated square image into VerbaLibera's full icon set.
#
# Image models cannot be trusted to produce alpha, so this expects a square
# image on a SOLID background (the generated cream ground) and derives
# everything from it. The background is kept rather than cut out — app icons are
# meant to be opaque.
#
# Usage:  scripts/brand/from-generated.sh <source-square.png>
#
# Writes: public/icons/verbalibera-512.png
#         public/icons/verbalibera-192.png
#         public/icons/verbalibera-maskable-512.png
#         public/apple-touch-icon.png
#         src/app/favicon.ico
set -euo pipefail

SRC="${1:-}"
if [[ -z "$SRC" ]]; then
  echo "usage: $0 <source-square.png>" >&2
  exit 2
fi
if [[ ! -f "$SRC" ]]; then
  echo "error: no such file: $SRC" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$ROOT/public/icons"

python3 - "$SRC" "$ROOT" <<'PY'
import sys, os
from PIL import Image

src, root = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
w, h = img.size

# A non-square source silently produces squashed icons; fail loudly instead.
if abs(w - h) > max(2, w * 0.01):
    sys.exit(f"error: source must be square, got {w}x{h}")


def resize(image, size):
    return image.resize((size, size), Image.LANCZOS)


def pad_to_safe_zone(image, size, ratio=0.72):
    """Maskable icons get cropped to a circle, so the design has to sit inside
    the safe zone. Scale the whole artwork down and pad it out with the
    background colour sampled from the source corner, so the padding is
    invisible whatever cream the model actually produced."""
    ground = image.getpixel((2, 2))
    inner = int(size * ratio)
    canvas = Image.new("RGBA", (size, size), ground)
    art = resize(image, inner)
    offset = (size - inner) // 2
    canvas.paste(art, (offset, offset), art)
    return canvas


outputs = [
    ("public/icons/verbalibera-512.png", resize(img, 512)),
    ("public/icons/verbalibera-192.png", resize(img, 192)),
    ("public/icons/verbalibera-maskable-512.png", pad_to_safe_zone(img, 512)),
    ("public/apple-touch-icon.png", resize(img, 180)),
]

for rel, out in outputs:
    path = os.path.join(root, rel)
    out.save(path, "PNG", optimize=True)
    print(f"  wrote {rel}  {out.size[0]}x{out.size[1]} {out.mode}")

# The favicon MUST be RGBA PNG-inside-ICO. PIL defaults to RGB and Next then
# 500s EVERY page with "The PNG is not in RGBA format". Always convert first.
ico_sizes = [(16, 16), (32, 32), (48, 48)]
favicon = os.path.join(root, "src/app/favicon.ico")
img.convert("RGBA").save(favicon, format="ICO", sizes=ico_sizes)
print(f"  wrote src/app/favicon.ico  {ico_sizes} RGBA")

# --- verification: assert what was written, do not assume -------------------
failures = []
for rel, out in outputs:
    path = os.path.join(root, rel)
    check = Image.open(path)
    if check.size != out.size:
        failures.append(f"{rel}: expected {out.size}, got {check.size}")
    if check.mode != "RGBA":
        failures.append(f"{rel}: expected RGBA, got {check.mode}")

with open(favicon, "rb") as fh:
    head = fh.read(8)
if head[:4] != b"\x00\x00\x01\x00":
    failures.append("favicon.ico: not a valid ICO header")

if failures:
    sys.exit("VERIFY FAILED:\n  " + "\n  ".join(failures))
print("  verified 4 PNGs + 1 ICO")
PY

echo "done. Run 'npx vitest run tests/service-worker.test.ts' — it pins the precache asset list."
