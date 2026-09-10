"""Replace whole lesson/concept fields with language-specific rewrites.

Why this exists: the First Words lessons across German, Spanish and Portuguese
were one lesson with the language swapped. Identical objectives, an identical
Latin-cognates angle, near-identical prompts, and three answers that were the
SAME STRING in all three packs ("Hello.", "Thank you.", "Three times.").
`cross-language-similarity.py` measured german/spanish at 88% and
portuguese/spanish at 92% identical English text, sharing one exercise shape. The
same pattern ran through six more topics.

This applies a payload of rewrites. It replaces the named fields of the named
entries and asserts each one landed, so a typo in an id fails loudly instead of
silently doing nothing. Idempotent: running it twice writes the same bytes.

Payload shape, per manifest:

    {
      "courses/german/manifest.json": {
        "concepts": [ { "id": "...", "explanation": "..." } ],
        "lessons":  [ { "id": "...", "objective": "...", "exercises": [ ... ] } ]
      }
    }

A payload may carry `concept` / `lesson` (one entry each) instead of the plural
lists; both are read, and a lesson named twice is applied once. A payload that
only names one lesson per manifest is how the first version of this format
silently dropped the second lesson of every pair, so both spellings are supported
now rather than one being correct.

Usage:
    env -u PYTHONPATH python3 scripts/content/differentiate-first-words.py <payload.json>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

COLLECTIONS = ("concepts", "lessons")


def entries_for(spec: dict, collection: str) -> list[dict]:
    """Both payload spellings, deduplicated by id, plural last so it wins."""
    singular = collection[:-1]  # concepts -> concept
    found: dict[str, dict] = {}
    for key in (singular, collection):
        value = spec.get(key)
        if value is None:
            continue
        for entry in value if isinstance(value, list) else [value]:
            found[entry["id"]] = entry
    return list(found.values())


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    payload = json.loads(Path(sys.argv[1]).read_text())

    applied = 0
    for manifest_path, spec in payload.items():
        if manifest_path.startswith("_"):
            continue
        path = Path(manifest_path)
        doc = json.loads(path.read_text())
        before = json.dumps(doc, sort_keys=True)

        for collection in COLLECTIONS:
            for entry in entries_for(spec, collection):
                target_id = entry["id"]
                index = next(
                    (i for i, e in enumerate(doc.get(collection, [])) if e["id"] == target_id),
                    None,
                )
                if index is None:
                    raise SystemExit(f'{manifest_path}: no {collection} entry with id "{target_id}"')
                # Replace only the fields the payload names, so ids and any field
                # the rewrite does not mention survive untouched.
                for field, value in entry.items():
                    if field == "id":
                        continue
                    doc[collection][index][field] = value
                applied += 1
                print(f"  {manifest_path:34s} {collection[:-1]:8s} {target_id} updated")

        if json.dumps(doc, sort_keys=True) != before:
            path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
            json.loads(path.read_text())  # prove it still parses

    print(f"  applied {applied} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
