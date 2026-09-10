"""Italian is schemaVersion 2: activities live in a TOP-LEVEL array and each
lesson is a list of `steps` with a `purpose`. This reports the v2 shape properly.
"""

from __future__ import annotations

import collections
import json

doc = json.load(open("courses/italian/manifest.json"))
acts = {a["id"]: a for a in doc["activities"]}
lessons = doc["lessons"]

print(f"===== italian (v{doc['schemaVersion']}) =====")
print(f"  top-level activities: {len(acts)}")
print(f"  activity kinds: {dict(collections.Counter(a['kind'] for a in acts.values()).most_common())}")
print()

print("  per-lesson STEP shape (purpose sequence) and the activity kinds behind it:")
shapes = collections.Counter()
purposes = collections.Counter()
for lesson in lessons:
    steps = lesson.get("steps") or []
    purp = [s.get("purpose") for s in steps]
    kinds = [acts.get(s.get("activityId"), {}).get("kind") for s in steps]
    purposes.update(p for p in purp if p)
    shapes[" > ".join(str(p) for p in purp)] += 1
    fam = lesson.get("family")
    print(f"    {lesson['id'][:32]:34s} fam={fam:12s} steps={len(steps)}")
    print(f"       purposes: {' > '.join(str(p) for p in purp)}")
    print(f"       kinds:    {' > '.join(str(k) for k in kinds)}")

print()
print(f"  distinct purpose sequences: {len(shapes)} (from {len(lessons)} lessons)")
for s, n in shapes.most_common(5):
    print(f"    {n:3d}x  {s}")
print(f"  purpose totals: {dict(purposes.most_common())}")

# step counts
counts = collections.Counter(len(l.get('steps') or []) for l in lessons)
print(f"  step-count distribution: {dict(counts)}")
