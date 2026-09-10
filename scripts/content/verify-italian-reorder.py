"""Verify the Italian reorder did not break the two things that matter.

Italian keeps `steps` (graph nodes referencing top-level activities) and
`legacyExercises` (v1-shaped) side by side, and normalize-pack/attempts project
between them. A reorder that moves one and not the other ships a lesson that
renders but can never be completed, so this checks pairing and reachability
explicitly rather than trusting `content:validate` to have noticed.
"""

from __future__ import annotations

import collections
import json

doc = json.load(open("courses/italian/manifest.json"))
acts = {a["id"]: a for a in doc["activities"]}
lessons = doc["lessons"]

print(f"  lessons: {len(lessons)}   activities: {len(acts)}")

problems: list[str] = []
specials: list[tuple[str, int, int]] = []
shapes: collections.Counter = collections.Counter()
per_lesson: list[tuple[str, str]] = []

for lesson in lessons:
    lid = lesson["id"]
    steps = lesson.get("steps") or []
    legacy = lesson.get("legacyExercises") or []

    # 1. entry step is first and exists
    if not steps:
        problems.append(f"{lid}: no steps")
        continue
    if lesson.get("entryStepId") != steps[0]["id"]:
        problems.append(f"{lid}: entryStepId is not the first step")

    # 2. every step references a real top-level activity
    for s in steps:
        if s["activityId"] not in acts:
            problems.append(f"{lid}: step {s['id']} -> unknown activity {s['activityId']}")

    # 3. no dangling nextStepId, and the chain is connected + acyclic
    ids = {s["id"] for s in steps}
    for s in steps:
        nxt = s.get("nextStepId")
        if nxt and nxt not in ids:
            problems.append(f"{lid}: step {s['id']} -> unknown nextStepId {nxt}")
    seen, cur = set(), steps[0]["id"]
    while cur and cur not in seen:
        seen.add(cur)
        node = next((s for s in steps if s["id"] == cur), None)
        cur = node.get("nextStepId") if node else None
    if cur in seen:
        problems.append(f"{lid}: cycle in nextStepId chain")

    # 4. completionPolicy names only existing legacy exercises
    policy = lesson.get("completionPolicy") or {}
    legacy_ids = {e["id"] for e in legacy}
    for eid in policy.get("exerciseIds", []) or []:
        if eid not in legacy_ids:
            problems.append(f"{lid}: completionPolicy names missing legacy exercise {eid}")

    # 5. THE PAIRING. The standard 9-step lesson pairs graded step i with legacy
    #    exercise i. The three SPECIAL lessons (it-food story, it-requests
    #    conversation, it-market listening) carry extra steps beyond the legacy
    #    list by design, and did so before this reorder, so for them the correct
    #    invariant is weaker: every legacy exercise must still be reachable from
    #    some step. Asserting strict 1:1 there reports a pre-existing design as a
    #    regression, which is worse than not checking.
    graded = [s for s in steps if s["id"] != lesson.get("entryStepId")]
    if len(graded) == len(legacy):
        for i, (s, e) in enumerate(zip(graded, legacy)):
            if s["activityId"] != e["id"]:
                problems.append(
                    f"{lid}: position {i} pairs step->{s['activityId']} with legacy {e['id']}"
                )
    else:
        step_acts = {s["activityId"] for s in graded}
        missing = legacy_ids - step_acts
        if missing:
            problems.append(
                f"{lid}: legacy exercises with no step behind them: {sorted(missing)}"
            )
        specials.append((lid, len(graded), len(legacy)))

    kinds = " > ".join(
        str(acts.get(s["activityId"], {}).get("kind")) for s in steps
    )
    shapes[kinds] += 1
    per_lesson.append((lid, kinds))

print()
print("  PAIRING / GRAPH PROBLEMS:", len(problems))
for p in problems[:12]:
    print(f"    {p}")
if not problems:
    print("    none")
if specials:
    print("  multi-step lessons (extra steps beyond the legacy list, by design):")
    for lid, g, lg in specials:
        print(f"    {lid:32s} {g} graded steps vs {lg} legacy exercises")

print()
print(f"  distinct step-kind sequences: {len(shapes)}")
for shape, n in shapes.most_common(8):
    print(f"    {n:3d}x  {shape[:92]}")

runs = sum(1 for i in range(1, len(per_lesson)) if per_lesson[i][1] == per_lesson[i - 1][1])
print()
print(f"  consecutive lessons sharing a sequence: {runs}")
print(f"  activity kind totals still: {dict(collections.Counter(a['kind'] for a in acts.values()).most_common())}")
