# Brief: Expand Listen Tracks to ~10 Minutes with Language Transfer Style

## Context
VerbaLibera's listen tracks are audio-only lessons using the Language Transfer
Thinking Method — the teacher explains concepts, the learner thinks through
patterns, then listens to confirm. Currently the French track is only ~2 min
(129s) with 7 sections. Italian is ~4.8 min with 18 sections. Spanish,
Portuguese, German are ~7 min each. All need to reach ~10 minutes (~1500 words
of teacher + target text combined).

## What to build
Expand ALL listen track JSON files to ~10 minutes of progressive,
multi-concept teaching. Each track should teach 3-5 interconnected concepts
that build on each other, not just one isolated concept.

## Files to modify
1. `src/features/listen/generated/italian.json` — expand from 18 sections to ~30 sections
2. `src/features/listen/generated/spanish.json` — expand to ~30 sections
3. `src/features/listen/generated/portuguese.json` — expand to ~30 sections
4. `src/features/listen/generated/german.json` — expand to ~30 sections
5. `src/features/listen/tracks.ts` — update French inline sections (currently 7) to ~30 sections; update `durationS` values for all tracks to accurate numbers

## Language Transfer Style (mandatory)
- Teacher speaks English, never pronounces target language words directly
- Each target phrase gets its OWN reveal clip (EN framing → pause → target voice)
- Progressive building: concept A is introduced, practiced, then concept B
  builds on A, then C builds on A+B
- Think-pauses: after explaining a pattern, say "Think. [scenario]. Build the
  sentence. Ten seconds, then listen." — give the learner time to construct
  before revealing
- Transfer moments: "You never learned this sentence. You derived it." — show
  how combining known blocks produces new understanding
- Natural pacing: ~150 words per minute of speech, ~2-3 second pauses between
  sections

## Section structure (JSON array)
Each section is an object with:
```json
{
  "heading": "Part N: descriptive name",
  "teacher": "English explanation text...",
  "target": { "text": "Target language phrase", "meaning": "English translation" }
}
```
The `target` field is OPTIONAL — some sections are pure framing/explanation.

## Content guidelines
- Start with what the learner already knows (from previous lessons in the
  foundations course) and extend from there
- Introduce 3-5 new vocabulary items per track, each in a useful sentence
- Include at least 2 "think" moments where the learner constructs before hearing
- Include at least 1 "transfer" moment showing how known blocks combine
- End with a full dialogue or scenario that uses everything taught
- Total word count target: 1400-1600 words across all teacher + target text

## Duration update
After expanding content, update `durationS` in `tracks.ts` for each track based
on actual word count at ~150 words/minute + ~2s pause per section.

## Constraints
- Do NOT modify test files
- Do NOT run any build commands
- Only modify the 5 files listed above
- Keep the existing section structure/schema — just add more sections and update
  content

## Current French track content (inline in tracks.ts, for reference)
The French track teaches: Je suis [name], nationality with gender (français/française),
3 names. It needs to expand to also cover: formal/informal greetings (tu/vous),
numbers 1-10, telling time ("Il est trois heures"), basic verbs (avoir, aller),
and a full introduction dialogue.

## Current Italian track content (in italian.json, for reference)  
Already covers: numbers 1-20, quantities (chilo, etto), prices (quanto costa),
polite requests (vorrei), greetings. Could expand to: family members, telling
time, directions, restaurant ordering.

## Current other tracks
Spanish: introductions, numbers, basic phrases
Portuguese: introductions, numbers, basic phrases
German: introductions, numbers, basic phrases
All need similar expansion to ~10 minutes with progressive building.
