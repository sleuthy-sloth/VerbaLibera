"""Profile the two big courses so a variety plan can be designed against facts.

French is schemaVersion 1 (lessons carry `exercises`); Italian is schemaVersion 2
(lessons carry `activities`, and the v2 runtime has its own family/kind set). Any
plan that assumes one shape for both is wrong, so this reports each in its own
terms.
"""

from __future__ import annotations

import collections
import json


def show(slug: str) -> None:
    doc = json.load(open(f"courses/{slug}/manifest.json"))
    lessons = doc["lessons"]
    version = doc.get("schemaVersion", 1)
    print(f"\n===== {slug}  (schemaVersion {version}, {len(lessons)} lessons) =====")

    key = "exercises" if version == 1 else "activities"
    shapes: collections.Counter = collections.Counter()
    kinds: collections.Counter = collections.Counter()
    per_lesson_kinds: list[tuple[str, list[str]]] = []

    for lesson in lessons:
        items = lesson.get(key) or []
        ks = [i.get("kind") for i in items]
        shapes[" > ".join(ks)] += 1
        kinds.update(ks)
        per_lesson_kinds.append((lesson["id"], ks))

    print(f"  distinct shapes: {len(shapes)}   (from {len(lessons)} lessons)")
    for shape, n in shapes.most_common(6):
        print(f"    {n:3d}x  {shape}")

    print(f"  kind totals: {dict(kinds.most_common())}")

    # How much room does each lesson have to differ? Distinct kind multiset per lesson.
    multisets: collections.Counter = collections.Counter(
        tuple(sorted(ks)) for _, ks in per_lesson_kinds
    )
    print(f"  distinct kind MULTISETS: {len(multisets)}")
    for ms, n in multisets.most_common(4):
        print(f"    {n:3d}x  {dict(collections.Counter(ms))}")

    if version == 1:
        # Which lessons could take a `transform` without new vocabulary?
        todo = [lid for lid, ks in per_lesson_kinds if "transform" not in ks]
        print(f"  lessons with no transform: {len(todo)}/{len(lessons)}")
    else:
        fams = collections.Counter(l.get("family", "(none)") for l in lessons)
        print(f"  families: {dict(fams)}")
        # v2 activity kinds actually present
        print(f"  activities per lesson: min={min(len(a) for _, a in per_lesson_kinds)} "
              f"max={max(len(a) for _, a in per_lesson_kinds)}")


for slug in ("french", "italian"):
    show(slug)
