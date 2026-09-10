"""Replace whole lesson/concept fields with language-specific rewrites.

The First Words lessons across German, Spanish and Portuguese were one lesson
with the language swapped: identical objectives, an identical Latin-cognates
angle, near-identical prompts, and three answers that were the SAME STRING in all
three packs ("Hello.", "Thank you.", "Three times."). `cross-language-similarity.py`
measured german/spanish at 88% and portuguese/spanish at 92% identical English
text with an identical exercise shape.

This applies the rewrite. It replaces named fields of named entries and asserts
each one landed, so a typo in an id fails loudly instead of silently doing
nothing. Idempotent: running it twice writes the same bytes.

The manifests are normalized to plain `json.dumps(indent=2)` on first write,
which is why the reformat is its own commit: on these hand-formatted files a
round-trip reflows ~140 unrelated lines and would bury the real change in review.

Usage:
    env -u PYTHONPATH python3 scripts/content/differentiate-first-words.py \
        scripts/content/lessons/first-words-differentiation.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    payload = json.loads(Path(sys.argv[1]).read_text())

    for manifest_path, spec in payload.items():
        if manifest_path.startswith("_"):
            continue
        path = Path(manifest_path)
        doc = json.loads(path.read_text())
        before = json.dumps(doc, sort_keys=True)

        for collection, entry in (("concepts", spec.get("concept")), ("lessons", spec.get("lesson"))):
            if not entry:
                continue
            target_id = entry["id"]
            index = next(
                (i for i, e in enumerate(doc[collection]) if e["id"] == target_id), None
            )
            if index is None:
                raise SystemExit(f'{manifest_path}: no {collection} entry with id "{target_id}"')
            # Replace only the fields the payload names, so ids and any field the
            # rewrite does not mention survive untouched.
            for field, value in entry.items():
                if field == "id":
                    continue
                doc[collection][index][field] = value
            print(f"  {manifest_path:34s} {collection[:-1]:8s} {target_id} updated")

        if json.dumps(doc, sort_keys=True) == before:
            print(f"  {manifest_path}: unchanged")
            continue
        path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        reloaded = json.loads(path.read_text())
        lesson = next(l for l in reloaded["lessons"] if l["id"] == spec["lesson"]["id"])
        print(
            f"  wrote {manifest_path}: "
            f"{len(lesson['exercises'])} exercises, "
            f"{[e['kind'] for e in lesson['exercises']]}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
