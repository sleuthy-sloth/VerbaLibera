"""Give every Italian lesson a speaking step.

The v2 player has had a complete `self-compare` activity since the player shipped
(schema, runtime, renderer, evidence) and NO pack has ever used it, so across
five courses not one lesson asks the learner to say anything. Italian is the v2
pack, so the activity kind is already there: this is content, not plumbing.

The spoken line is not invented. Each lesson already contains a production
exercise whose accepted answer is a real sentence in Italian, and a listening
exercise whose audio is the model recording of a sentence. This script lifts the
answer from the production exercise and attaches the listening audio only when
the two sentences are actually the same, because comparing your pronunciation
against a recording of a DIFFERENT sentence is worse than having no model audio.

The new step is `required: false`, matching the existing listen-model step: a
learner with no microphone must still be able to finish the lesson, and
`completionPolicy` is a `legacy-success` policy whose ids must exactly equal the
legacy exercise ids, which a new self-assessed step has no legacy counterpart
for.

Run with --check to report what would change; without it, rewrites the manifest.
"""

from __future__ import annotations

import json
import sys

PATH = "courses/italian/manifest.json"
# Lesson 0 and 1 are frozen: an end-to-end test drives lesson 1 step by step.
FIRST_LESSON = 2


def build(doc: dict) -> tuple[list[dict], list[str]]:
    activities = {a["id"]: a for a in doc["activities"]}
    stimuli = {s["id"]: s for s in doc["stimuli"]}
    media_ids = {m["id"] for m in doc["media"]}
    added: list[dict] = []
    notes: list[str] = []

    for index, lesson in enumerate(doc["lessons"]):
        if index < FIRST_LESSON:
            continue
        steps = lesson["steps"]

        # The production exercise. `text` covers both directions: an activity
        # whose skills are writing/grammar wants the sentence IN Italian, while
        # one marked reading/vocabulary wants its English meaning. Taking the
        # first text step unqualified picked the meaning exercise in about half
        # the lessons and asked the learner to say English out loud.
        source_step = next(
            (
                s
                for s in steps
                if "writing" in activities[s["activityId"]].get("skills", [])
                and activities[s["activityId"]]["kind"] == "text"
            ),
            None,
        )
        if source_step is None:
            notes.append(f"{lesson['id']}: no production step, skipped")
            continue
        source = activities[source_step["activityId"]]
        answers = source.get("answer", {}).get("answers") or []
        if not answers:
            notes.append(f"{lesson['id']}: production step has no answer, skipped")
            continue
        model_text = answers[0]

        # The listen step's audio, used only if it is the same sentence.
        model_audio: str | None = None
        for step in reversed(steps):
            activity = activities[step["activityId"]]
            stimulus = stimuli.get(activity.get("stimulusId") or "")
            if stimulus is None or stimulus.get("kind") != "audio":
                continue
            listen_answers = activity.get("answer", {}).get("answers") or []
            media_id = stimulus.get("mediaId")
            if media_id in media_ids and listen_answers and listen_answers[0] == model_text:
                model_audio = media_id
            break
        if model_audio is None:
            notes.append(f"{lesson['id']}: listen audio is a different sentence, no model audio")

        activity = {
            "kind": "self-compare",
            "id": f"{lesson['id']}-say",
            "revision": 1,
            "conceptIds": list(source["conceptIds"]),
            "vocabulary": list(source["vocabulary"]),
            "skills": ["speaking"],
            "prompt": source["prompt"],
            "modelText": model_text,
        }
        if model_audio:
            activity["modelAudioId"] = model_audio

        new_step = {
            "id": f"{lesson['id']}-step-say",
            "activityId": activity["id"],
            "purpose": "practice",
            "required": False,
            "nextStepId": source_step["nextStepId"],
            "branches": {},
        }

        # Splice in immediately after the production step: the learner has just
        # written the sentence correctly, which is the moment to say it.
        at = steps.index(source_step)
        source_step["nextStepId"] = new_step["id"]
        steps.insert(at + 1, new_step)
        added.append(activity)
        notes.append(f"{lesson['id']}: say \"{model_text}\"" + ("" if model_audio else "   [no model audio]"))

    return added, notes


def main() -> int:
    check = "--check" in sys.argv
    with open(PATH) as handle:
        doc = json.load(handle)

    added, notes = build(doc)
    for note in notes:
        print(f"  {note}")
    print(f"\n  {len(added)} speaking activities across {len(doc['lessons'])} lessons")

    if check:
        print("  (--check: nothing written)")
        return 0

    existing = {a["id"] for a in doc["activities"]}
    fresh = [a for a in added if a["id"] not in existing]

    if not fresh:
        print("  already applied; version left alone")
        return 0

    doc["activities"].extend(fresh)
    # Bump the pack's own patch version. Hardcoding one previously REGRESSED this
    # file: the script wrote 0.4.1 over the 1.4.1 the course had reached, which
    # would have looked like a downgrade in review.
    major, minor, patch = doc["version"].split(".")
    doc["version"] = f"{major}.{minor}.{int(patch) + 1}"
    with open(PATH, "w") as handle:
        json.dump(doc, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"  written to {PATH}; version -> {doc['version']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
