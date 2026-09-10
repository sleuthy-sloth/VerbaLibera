"""How much of each brand asset's frame does the drawing actually use?

An asset with large baked-in cream margins renders inside its layout box as a
small mark floating in dead space, which reads as "tossed in". Measures the
non-ground bounding box of every brand image.
"""
from typing import Any, cast

from PIL import Image

CANVAS = (0xFB, 0xF4, 0xE6)
TOL = 26

ASSETS = [
    ("public/brand/logo-mark.jpg", 1),
    ("public/brand/logo-lockup.jpg", 1),
    ("public/brand/hero-banner.jpg", 1),
    ("public/brand/empty-journal.jpg", 1),
    ("public/og-card.jpg", 1),
    ("public/brand/courses/french.jpg", 1),
    ("public/brand/courses/italian.jpg", 1),
    ("public/brand/courses/spanish.jpg", 1),
    ("public/brand/courses/portuguese.jpg", 1),
    ("public/brand/courses/german.jpg", 1),
]


def art_bbox(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = cast(Any, im.load())

    def has(x, y):
        p = px[x, y]
        return max(abs(p[i] - CANVAS[i]) for i in range(3)) > TOL

    xs = [x for x in range(0, w, 2) if any(has(x, y) for y in range(0, h, 6))]
    ys = [y for y in range(0, h, 2) if any(has(x, y) for x in range(0, w, 6))]  # noqa: E501
    if not xs or not ys:
        return None
    return (min(xs), min(ys), max(xs), max(ys)), (w, h)


print(f'{"asset":36s} {"frame":11s} {"art fills":10s} margins L/R/T/B (%)   parity')
print("-" * 92)
for path, _ in ASSETS:
    try:
        box, (w, h) = art_bbox(path)
    except FileNotFoundError:
        print(f"{path:36s} MISSING")
        continue
    x0, y0, x1, y1 = box
    fw = (x1 - x0) / w * 100
    fh = (y1 - y0) / h * 100
    ml, mr = x0 / w * 100, (w - x1) / w * 100
    mt, mb = y0 / h * 100, (h - y1) / h * 100
    # A top margin much smaller than the bottom means the art sits high, and the
    # reverse means dead weight under it. Warn past 6 points of difference.
    worst = max(ml, mr, mt, mb) - min(ml, mr, mt, mb)
    flag = "OK" if worst <= 8 and min(fw, fh) >= 80 else ("loose" if worst > 8 else "small mark")
    print(
        f"{path.replace('public/brand/',''):36s} {w}x{h:<6d} {fw:3.0f}% x {fh:3.0f}%  "
        f"{ml:4.0f} {mr:4.0f} {mt:4.0f} {mb:4.0f}   {flag}"
    )
