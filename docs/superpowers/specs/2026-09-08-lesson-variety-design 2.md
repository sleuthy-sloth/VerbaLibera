# Varied lessons and learning modes: design specification

Date: 2026-09-08. Status: design handoff requested by the user; implementation has not started in this planning task.

## Goal and scope

Replace the repeated explanation → examples → typed answer experience with authored sequences of activities and distinct workspaces. Keep VerbaLibera's practical sentence construction, Quiet Ink design, deterministic grading, and offline editions. Learning preferences are adjustable choices, never a diagnosis or fixed learner identity.

Deliver all eight families in a staged rollout. A three-family Italian pilot is an integration checkpoint, not completion of the feature. Complete one authored example of every family in Italian, then deliberately adapt an eight-lesson varied sequence in each other active foundation language. Existing lessons outside that sequence continue working unchanged.

## Global constraints

- Preserve existing user progress, lesson IDs, exercise IDs, account isolation, backup import, and offline operation.
- No runtime AI, speech recognition dependency, generated speech at runtime, or network dependency for core lessons.
- No timers, punitive mechanics, mandatory microphone access, or fixed learning-style labels.
- Keep the Quiet Ink visual language and the existing 760px mobile / 761px desktop boundary.
- Node >=22.13.0; use the repository's installed Next.js, React, TypeScript, Zod, Vitest, and Playwright versions without an unrelated dependency upgrade.
- Read AGENTS.md and the locally installed Next.js documentation before changing framework code.
- Author source content in courses/<language>/manifest.json; generate public/packs output through the existing content build.
- Never treat self-assessment, model reveal, or unavailable media as independently demonstrated mastery.
- Save success is shown only after durable storage confirms the transaction; retain truthful temporary-storage messaging.
- Preserve existing uncommitted work and verify the active checkout before implementing.

## Families and sequences

| Family key | Sequence | Workspace |
| --- | --- | --- |
| discovery | Compare → predict → explain → transfer | Paired examples; selectable differences; explanation revealed after prediction |
| story | Read → find evidence → sequence events → respond | Persistent short story alongside activity; glosses and translation on request |
| conversation | Understand turn → choose intention → construct reply → consequence | Thread and reply composer; visible goal; authored branches |
| listening | Gist → distinguish → reconstruct → compare transcript | Audio-led screen; replay/speed controls; transcript as explicit assistance |
| construction | Assemble → substitute → transform → repair → independent production | Sentence workbench; token controls; before/after comparison |
| scene | Explore → identify → relate → describe | Menu, map, or scene with labeled selectable regions and text alternative |
| mission | Brief → consult reference → complete subtasks → demonstrate goal | Persistent reference, task checklist, activity panel |
| recall | Retrieve → inspect targeted feedback → retry with new example | Minimal prompt; focused repair; independent transfer item |

Family determines presentation and authoring expectations, not grading. Each activity declares its assessed skill independently. An audio replay is not automatically an answer reveal. A transcript used in listening assessment is assistance. Reading translation or glosses are assistance when they supply the evidence being assessed.

## Content architecture

Introduce a version-two course pack and an explicit version-one adapter. Keep metadata, units, concepts, vocabulary, existing exercises, and dialogues available during transition. Add stimuli, activities, and lesson steps. Normalize both versions into one runtime representation at the loading boundary. Keep the existing v1 validation entry point available to callers until they are deliberately migrated.

Every lesson retains a stable ID, unit, objective, prerequisites, concept/vocabulary references, and legacy exercise collection. V2 adds revision, family, estimatedMinutes, entryStepId, steps, and completionPolicy. Each step has a stable ID, purpose, activity reference, required flag, next step, optional support activity, and explicit branches for applicable dialogue choices. The authored graph is acyclic and finite; retry revisits the current activity in session state rather than creating a graph cycle.

Stimuli are reusable text, example pairs, audio, dialogue turns, or scenes. Activities are typed interactions: legacy exercise, information, text, selection, ordering, matching, inline cloze, dialogue choice, scene selection, and self-comparison. Feedback belongs to the activity and never leaks accepted responses before submission. Do not render a generic textarea for every new interaction.

Only completed required steps on the chosen valid branch are needed for participation completion. Optional support rejoins its originating step. Completion and independent skill evidence are separate projections. Newly authored prerequisites can require participation or a specified number of independently successful evidence targets. Adapted v1 prerequisites and completion preserve the current success-based behavior.

## Responsive interaction design

Common shell: back link, lesson title, practical goal, one progress indicator, contextual content, activity area, and primary action. Use 40/60 context/activity columns above 760px, constrained to the existing content width. At 760px and below use one column, context first, with an accessible reference disclosure; do not conceal required context behind an unlabeled icon. Conversation and construction may use full-width content.

Do not display a universal explanation/examples preamble before story, listening, or conversation lessons. Move explanation into the authored sequence. Keep course-level controls outside the focused lesson workspace where existing navigation allows it. Show feedback adjacent to the answer; restore focus to the next activity heading after advancing. No duplicate progress bars or automatic audio playback.

All controls work with keyboard and screen readers. Tile order has explicit add/remove/move controls; dragging is optional. Scenes use semantic region buttons and equivalent text tasks. Correctness is never color-only. Use reduced-motion behavior and no forced countdown. Self-comparison has a model reveal and an honest self-report action, not a machine pronunciation score.

## Progress and durability

Keep v1 practice events readable and unmodified. Add versioned attempt and step-completion events with stable IDs, content revision, chosen branch, assistance, assessment method, and explicit outcomes. Retain old and unknown retired IDs in backups. Duplicate event IDs with identical content are idempotent; conflicting content is rejected atomically. Events from one account never enter another account's store.

Activity evidence targets provide a stable review identity. Reuse an old exercise ID only where assessed meaning and answer contract remain equivalent. A changed answer target receives a new identity; cosmetic changes can retain it. Preserve old v1 completion as a legacy completion credit for the same lesson; new activities remain available as enrichment and must not relock already unlocked lessons.

Self-assessment, ungraded steps, and blocked media do not schedule successful independent review. Display “practised” and “completed” separately from evidence of independent success. Unknown or unsupported event versions cause an explicit import/sync compatibility error, not silent stripping. Checkpoint/resume includes branch, step, assistance, and draft response; restoring after model reveal must not produce unassisted evidence.

## Preferences and fallback

Persist per-profile preferences: audio availability, speaking availability, guidance (guided/balanced/independent), preferred modes (read/listen/build/speak/visual). Defaults: audio available, speaking optional, balanced guidance, no preferred mode. Ask no onboarding questionnaire; expose a small “Practice options” control.

Preferences reorder eligible recommendations and optional support, not prerequisite correctness or mastery. Missing audio offers retry or an authored reading alternative, explicitly labeled as reading practice. Required listening evidence stays unmet until attempted with audio. A scene's text alternative evaluates an equivalent textual task with the correct skill label. Speaking is optional self-comparison without recording or upload.

## Content rollout and acceptance

Start with Italian story, conversation, and listening lessons about café interactions, using only taught language or explicitly introducing prerequisites. Then add discovery, construction, scene, mission, and recall. Include an authored transfer task, not just the same answer repeated. Use existing verified audio only when its transcript fits; new audio must be prerecorded with attribution and provenance under the existing workflow.

For French, author a coherent eight-lesson sequence covering all families; localize grammar, cultural details, accepted answers, and supporting media. Spanish, Portuguese, and German sequences are gated on foundation depth (each pack currently holds a single lesson) and, for German, a TTS decision — Kokoro has no German voice. Do not translate Italian token order mechanically. Require documented language review and audio listening review; unreviewed content stays out of the default published path. New listening lessons target ~10-minute multi-concept tracks (Language-Transfer style), produced through the existing voice-sidecar workflow with provenance and STT QA.

Track family counts, interaction counts, consecutive identical interactions, independent production opportunities, and reused answer sets. Default authoring warnings: more than two consecutive graded activities with identical interaction kind, more than two adjacent lessons of one family, or an answer set reused more than twice within a lesson. Intentional repetition in recall is allowed with an author rationale. Reports support editorial review; quotas never silently rearrange authored sequences.

Feature completion requires all eight families, the Italian and French varied sequences, v1 compatibility, hosted/portable/desktop integration, accessible responsive layouts, verified backup/sync/resume, and the documented validation report. No deployment or release is part of the implementation handoff unless separately requested.
