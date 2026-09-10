"""What the exercise MIX actually is, per course.

A kind's name hides a lot: `translate` runs in two modes that are different
exercises entirely, "give the English meaning" (recognition, cheap) and "write in
French" (production, the real work). Counting kinds alone therefore understates
how much of a course is one thing, so this reports kind x mode and, for text
answers, whether the prompt asks for the target language or the learner's own.
"""

from __future__ import annotations

import collections
import glob
import json
import os
import re


def target_language_prompt(prompt: str) -> bool:
    """Heuristic: does this ask for output in the language being learned?"""
    p = prompt.lower()
    return bool(
        re.search(r"write in |say |ask |tell |order |make the|give the|build", p)
        and not re.search(r"english meaning|in english", p)
    )


for path in sorted(glob.glob("courses/*/manifest.json")):
    slug = os.path.basename(os.path.dirname(path))
    doc = json.load(open(path))
    version = doc.get("schemaVersion", 1)
    mix: collections.Counter = collections.Counter()
    modes: collections.Counter = collections.Counter()

    if version == 1:
        items = [e for l in doc["lessons"] for e in l.get("exercises", [])]
        for e in items:
            mix[e["kind"]] += 1
            modes[f'{e["kind"]}:{e.get("mode", "?")}'] += 1
    else:
        acts = {a["id"]: a for a in doc["activities"]}
        # Only activities a lesson actually reaches, so unused ones do not skew it.
        reached = {
            s["activityId"]
            for l in doc["lessons"]
            for s in (l.get("steps") or [])
            if s["activityId"] in acts
        }
        for aid in reached:
            a = acts[aid]
            mix[a["kind"]] += 1
            modes[a["kind"]] += 1

    total = sum(mix.values())
    print(f"\n===== {slug}  (v{version}, {total} activities in lessons)")
    for k, n in mix.most_common():
        print(f"    {k:16s} {n:4d}  {n / total * 100:5.1f}%")
    if version == 1:
        print("  by mode:")
        for m, n in modes.most_common():
            print(f"    {m:28s} {n:4d}  {n / total * 100:5.1f}%")

print("\n\n===== across every course =====")
allk: collections.Counter = collections.Counter()
allmodes: collections.Counter = collections.Counter()
grand = 0
for path in sorted(glob.glob("courses/*/manifest.json")):
    doc = json.load(open(path))
    version = doc.get("schemaVersion", 1)
    if version == 1:
        for e in [e for l in doc["lessons"] for e in l.get("exercises", [])]:
            allk[e["kind"]] += 1
            allmodes[f'{e["kind"]}:{e.get("mode", "?")}'] += 1
            grand += 1
    else:
        acts = {a["id"]: a for a in doc["activities"]}
        reached = {s["activityId"] for l in doc["lessons"] for s in (l.get("steps") or [])}
        for aid in reached & set(acts):
            allk[acts[aid]["kind"]] += 1
            grand += 1
for k, n in allk.most_common():
    print(f"    {k:16s} {n:4d}  {n / grand * 100:5.1f}%")
print(f"\n    total: {grand}")
print(f"    kinds present: {len(allk)}")
