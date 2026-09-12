"""Report how much the same-topic lessons across languages actually share.

The complaint is that "First Words" is near word for word across languages. A
similarity score per field turns that into something checkable, and it runs over
every topic so the same question can be asked of the rest of the packs.

Usage:
    env -u PYTHONPATH python3 scripts/content/cross-language-similarity.py
    env -u PYTHONPATH python3 scripts/content/cross-language-similarity.py first-words
"""

from __future__ import annotations

import difflib
import glob
import json
import os
import sys

# English scaffolding that appears in every pack and is therefore not evidence
# of copied content: it is the shared authoring voice.
SCAFFOLD = (
    "Give the English meaning",
    "Read the",
    "Build the sentence",
    "Complete the",
    "Say ",
    "Predict the form",
    "Change ",
    "Which ",
    "According to",
)


def exercises_of(lesson: dict) -> list[dict]:
    """The authored exercises, whichever schema the pack is on.

    A v2 pack keeps the retained v1 records in legacyExercises; reading only
    exercises made every migrated pack (French, German) compare as empty.
    """
    return lesson.get("exercises") or lesson.get("legacyExercises") or []


def explanation_of(pack: dict, lesson: dict) -> str:
    """The authored lesson prose, whichever schema the pack is on.

    v1 keeps it on the lesson; the v1->v2 migration relocates it into the
    lesson's opening information activity body.
    """
    direct = lesson.get("explanation")
    if direct:
        return direct
    for activity in pack.get("activities", []):
        if activity.get("id") == f"{lesson.get('id')}-intro":
            return activity.get("body", "")
    return ""


def texts(lesson: dict, pack: dict | None = None) -> dict[str, str]:
    """Every authored English string in a lesson, by field."""
    fields: dict[str, str] = {
        "title": lesson.get("title", ""),
        "objective": lesson.get("objective", ""),
        "explanation": explanation_of(pack or {}, lesson),
    }
    for key in ("prompt", "explanation", "passage", "translation"):
        for i, ex in enumerate(exercises_of(lesson)):
            value = ex.get(key)
            if isinstance(value, str) and value:
                fields[f"{i}:{ex.get('kind')}.{key}"] = value
    return fields


def ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def main() -> int:
    topic = sys.argv[1] if len(sys.argv) > 1 else None
    packs = {}
    raw_packs = {}
    for path in sorted(glob.glob("courses/*/manifest.json")):
        slug = os.path.basename(os.path.dirname(path))
        raw = json.load(open(path))
        raw_packs[slug] = raw
        packs[slug] = {l["id"]: l for l in raw["lessons"]}

    # Match lessons to each other by their topic suffix, e.g. *-first-words-foundation
    topic_of = {}
    for slug, lessons in packs.items():
        for lid in lessons:
            key = lid.split(f"{packs[slug][lid].get('unitId', '')}")[0]
            suffix = lid.split("-foundation")[0].split("-", 1)[-1]
            topic_of.setdefault(suffix, []).append((slug, lid))

    topics = sorted(t for t, v in topic_of.items() if len(v) > 1)
    if topic:
        topics = [t for t in topics if topic in t]

    print(f"{'topic':34s} {'pair':20s} {'same shape':>10s} {'avg text':>9s}")
    print("-" * 78)
    flagged = []
    for name in topics:
        entries = topic_of[name]
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                (sa, la), (sb, lb) = entries[i], entries[j]
                A, B = packs[sa][la], packs[sb][lb]
                ka = [e.get("kind") for e in exercises_of(A)]
                kb = [e.get("kind") for e in exercises_of(B)]
                ta, tb = texts(A, raw_packs[sa]), texts(B, raw_packs[sb])
                # Compare only the English scaffolding fields, matched by name.
                shared = [k for k in ta if k in tb]
                scores = [ratio(ta[k], tb[k]) for k in shared]
                avg = sum(scores) / len(scores) if scores else 0.0
                same = "yes" if ka == kb else "no"
                if avg >= 0.6 or ka == kb:
                    flagged.append((name, f"{sa}/{sb}", ka == kb, avg))
                print(f"{name:34s} {sa + '/' + sb:20s} {same:>10s} {avg:8.0%}")

    print()
    if flagged:
        print("FLAGGED: same shape, or over 60% identical English text")
        for name, pair, same_shape, avg in flagged:
            print(f"  {name:34s} {pair:20s} shape={same_shape} text={avg:.0%}")
    else:
        print("nothing flagged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
