from PIL import Image
from typing import Any, cast
import glob

CANVAS = (0xFB, 0xF4, 0xE6)


def is_ground(px: Any, x: int, y: int) -> bool:
    pixel = cast(tuple[int, int, int], px[x, y])
    return all(abs(pixel[i] - CANVAS[i]) <= 10 for i in range(3))


print(
    f"{'banner':12s} {'size':11s} {'art starts':>12s} {'quiet L':>8s} {'quiet R':>8s}"
)
for path in sorted(glob.glob("public/brand/courses/*.jpg")):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    cols = [
        sum(0 if is_ground(px, x, y) else 1 for y in range(0, h, 4))
        for x in range(w)
    ]
    first = next((x for x, c in enumerate(cols) if c > 0), -1)
    last = next((x for x in range(w - 1, -1, -1) if cols[x] > 0), -1)
    name = path.split("/")[-1].replace(".jpg", "")
    if first < 0:
        print(f"{name:12s} {w}x{h:<6d} {'no art':>12s}")
        continue
    print(
        f"{name:12s} {w}x{h:<6d} {f'{first} ({first / w * 100:.0f}%)':>12s} "
        f"{first / w * 100:7.0f}% {100 - last / w * 100:7.0f}%"
    )

print()
print("A title in the reserved left third needs art to start at or after 33%.")
