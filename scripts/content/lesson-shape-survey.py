import json
import glob
import os
import collections

for path in sorted(glob.glob("courses/*/manifest.json")):
    d = json.load(open(path))
    slug = os.path.basename(os.path.dirname(path))
    lessons = d.get("lessons", [])
    print(f"\n=== {slug}  (schema v{d.get('schemaVersion', 1)}, {len(lessons)} lessons) ===")
    for lesson in lessons:
        ex = lesson.get("exercises", [])
        kinds = [e.get("kind") for e in ex]
        fam = lesson.get("family", "-")
        print(f"  {lesson['id'][:34]:36s} {len(ex):3d} ex  fam={fam:12s}")
        print(f"     {' > '.join(kinds)}")

print("\n\n=== activity kinds available across all packs ===")
kinds = collections.Counter()
for path in glob.glob("courses/*/manifest.json"):
    d = json.load(open(path))
    for lesson in d.get("lessons", []):
        for ex in lesson.get("exercises", []):
            kinds[ex.get("kind")] += 1
for k, n in kinds.most_common():
    print(f"  {k:14s} {n}")
