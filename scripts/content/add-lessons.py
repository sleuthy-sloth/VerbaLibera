"""Add authored units/lessons to a course manifest without reformatting it.

Why a splice and not a JSON round-trip: the manifests are pretty-printed by hand
in a mix of inline and expanded styles. `json.dumps(indent=2)` on one of them
reformats ~140 lines that have nothing to do with the change, which buries the
real addition in review. This inserts only the new entries, at the indentation
the surrounding file already uses, so `git diff` shows additions and nothing else.

Idempotent: an entry whose id is already present is skipped, so running it twice
is safe and re-running after editing the JSON is how you evolve a unit.

Usage:
    env -u PYTHONPATH python3 scripts/content/add-lessons.py scripts/content/lessons/de-unit-3-4.json
    env -u PYTHONPATH python3 scripts/content/add-lessons.py <file> --check   # write nothing
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def array_close_index(text: str, key: str) -> int:
    """Index of the newline before the `]` that closes the top-level array `key`.

    Anchor on the two-space indentation of a top-level key, never on the bare
    `"key": [` string. Lessons and exercises carry their OWN `"vocabulary": [`
    and `"concepts"`-like keys, so `text.index('"vocabulary": [')` silently finds
    the one inside the first lesson: the entries land in whichever array happens
    to close first and the pack ends up with 24 "lessons" and no new words. The
    indentation is what makes the top-level one unique, so assert that it is.
    """
    needle = f'\n  "{key}": ['
    if text.count(needle) != 1:
        raise SystemExit(
            f'expected exactly one top-level "{key}" array, found {text.count(needle)}'
        )
    close = text.find("\n  ]", text.index(needle))
    if close < 0:
        raise SystemExit(f'could not find the closing bracket of "{key}"')
    return close


def render(entry: dict, indent: int = 4) -> str:
    """One entry formatted exactly as json.dumps(indent=2) would nest it."""
    body = json.dumps(entry, indent=2, ensure_ascii=False)
    pad = " " * indent
    return "\n".join(pad + line if line.strip() else line for line in body.split("\n"))


def splice(text: str, key: str, additions: list[dict], existing_ids: set[str]) -> tuple[str, int]:
    fresh = [e for e in additions if e.get("id") not in existing_ids]
    if not fresh:
        return text, 0
    close = array_close_index(text, key)
    block = ",\n".join(render(e) for e in fresh)
    # The existing final element has no trailing comma, so supply it here.
    return text[:close] + ",\n" + block + text[close:], len(fresh)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    if len(args) != 1:
        raise SystemExit(__doc__)

    source = Path(args[0])
    data = json.loads(source.read_text())
    manifest = Path(data["manifest"])
    text = manifest.read_text()
    original = text

    for key in ("units", "concepts", "vocabulary", "lessons"):
        additions = data.get(key) or []
        if not additions:
            continue
        existing = {e["id"] for e in json.loads(text)[key]}
        text, added = splice(text, key, additions, existing)
        print(f"  {key:11s} +{added}")

    # Bump the pack version so a content change is visible in the artefacts.
    version = data.get("version")
    if version:
        before = json.loads(text)["version"]
        text = text.replace(f'"version": "{before}"', f'"version": "{version}"', 1)
        print(f'  version     {before} -> {version}')

    if check:
        print("  --check: nothing written")
        return 0
    if text == original:
        print("  nothing to do")
        return 0
    manifest.write_text(text)
    # Prove the file still parses before anyone trusts it.
    parsed = json.loads(manifest.read_text())
    print(
        f"  wrote {manifest}  "
        f"({len(parsed['lessons'])} lessons, {len(parsed['concepts'])} concepts, "
        f"{len(parsed['vocabulary'])} words)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
