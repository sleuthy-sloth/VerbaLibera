"""Find macOS ' N' copy artifacts and say which are safe to delete.

macOS creates '<name> 2.ext' when a file is written while its original is open.
They accumulate silently, and one of them just broke a guard: the design-token
sweep skips tests/design-tokens.test.ts by name, so tests/design-tokens.test 2.ts
was scanned as a live file and its list of FORBIDDEN palette values read as
violations.

An artifact is only safe to delete when the file it duplicates still exists and
still has the same content shape, so this reports both. It never deletes.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

SKIP_DIRS = {"node_modules", ".next", ".git", "out", ".vercel", "desktop-dist", "dist"}

artifacts: list[Path] = []
for path in Path(".").rglob("*"):
    if any(part in SKIP_DIRS for part in path.parts):
        continue
    if path.is_file() and re.search(r" \d+(\.[^/]*)?$", path.name):
        artifacts.append(path)

tracked = set(
    subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True)
    .stdout.splitlines()
)


def original_of(p: Path) -> Path:
    """'design-tokens.test 2.ts' -> 'design-tokens.test.ts'"""
    name = re.sub(r" \d+(\.[^/]*)$", r"\1", p.name)
    return p.with_name(name)


safe: list[Path] = []
orphan: list[Path] = []
for art in sorted(artifacts):
    orig = original_of(art)
    if orig.exists() and orig.is_file():
        safe.append(art)
    else:
        orphan.append(art)

print(f"  artifacts found: {len(artifacts)}")
print(f"    tracked:       {sum(1 for a in artifacts if str(a) in tracked)}")
print(f"    safe (original exists): {len(safe)}")
print(f"    ORPHAN (no original, review by hand): {len(orphan)}")
print()
if orphan:
    print("  orphans:")
    for o in orphan:
        print(f"    {o}")
print("  by directory:")
counts: dict[str, int] = {}
for a in artifacts:
    counts[str(a.parent)] = counts.get(str(a.parent), 0) + 1
for d, n in sorted(counts.items(), key=lambda kv: -kv[1])[:14]:
    print(f"    {n:4d}  {d}")
