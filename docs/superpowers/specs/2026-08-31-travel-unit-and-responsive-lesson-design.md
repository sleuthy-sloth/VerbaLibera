# VerbaLibera Travel Unit and Responsive Lesson Design

Date: 2026-08-31

Status: Approved in conversation; ready for implementation planning.

## Objective

Replace the two single-pattern demonstration shells with the first original A1 travel unit for English-to-French and English-to-Italian. Each course will contain five parallel, practical patterns: greeting politely, ordering food or coffee, asking where something is, asking for help, and paying or requesting the bill.

The experience remains explicitly preview-only. A learner may complete cards, earn displayed preview XP, and see a session celebration, but no interaction writes progress or asserts mastery. Persisted progress becomes a subsequent phase after authentication, an explicit learner-data policy, server-side assessment/mutation commands, and a durable progress model have been implemented and reviewed.

## Teaching sequence

Every authored pattern follows an original `notice → build → vary → use` sequence:

1. **Notice:** a short usage cue explains one reusable relationship in plain English. It supports reasoning without naming or reproducing a third-party method.
2. **Build:** a model prompt and target-language answer establish a complete, useful sentence in context.
3. **Vary:** controlled substitution and transformation prompts change one meaningful part at a time so the learner practices the structure rather than a disconnected word list.
4. **Use:** an independent scenario asks for an appropriate response; the learner may reveal the model answer and self-check.

This takes inspiration from guided structural reasoning, pattern drills, and scenario-centred communicative lessons. All copy, prompts, accepted responses, dialogues, artwork, and UI remain authored specifically for VerbaLibera. The application must not reproduce Language Transfer, DLI/FSI, Busuu, FreeLingo, Lingo Lessons, LibreLingo, or related products' lesson text, recordings, trade dress, characters, or exercise sequences.

## Authored content model

Extend the fixture type so a concept/pattern can provide the authored lesson fields used by the session UI:

- `scenario`: a short real-world situation label;
- `notice`: a concise reusable cue;
- `modelDialogue`: a prompt/answer exchange; and
- drills with ordered prompt variants and accepted target-language responses.

Keep existing course, audio-segment, provenance, and drill fields compatible. New content is `ORIGINAL`; unavailable audio remains visibly identified as unavailable. Fixtures contain enough French and Italian material for all five patterns and never imply CEFR certification.

### Unit 1 pattern map

| Position | Scenario | French anchor | Italian anchor | Drill intent |
| --- | --- | --- | --- | --- |
| 1 | Greeting politely | `Bonjour, je voudrais…` | `Buongiorno, vorrei…` | combine greeting and a polite request |
| 2 | Ordering coffee or food | `Je voudrais un café…` | `Vorrei un caffè…` | substitute the requested item |
| 3 | Finding a place | `Où est… ?` | `Dov’è… ?` | ask for places and transform a statement into a question |
| 4 | Asking for help | `Pouvez-vous m’aider ?` | `Può aiutarmi?` | vary the requested assistance politely |
| 5 | Paying | `L’addition, s’il vous plaît.` | `Il conto, per favore.` | select a close and polite service interaction |

Author accepted variants only where they preserve the taught intent. They should accept harmless punctuation/case differences in a later answer matcher, but fixture data must retain conventional spelling, punctuation, accents, and diacritics.

## Session interaction

Session steps must resolve the pattern and drill named by their step ID, rather than always selecting the first course concept. The guided session presents one card at a time with:

- scenario and path context;
- concise notice or drill instruction;
- model phrase hidden until the learner selects **Reveal model answer** when the step calls for independent production;
- an optional self-check state that acknowledges the learner without claiming assessment or mastery;
- one clear next action; and
- an accurate step rail and accessible progress value.

Review, drill, and new-pattern cards use the same interaction vocabulary but render the appropriate authored field. An unknown step or missing content produces a safe, actionable unavailable state instead of misleading fallback content.

The completion screen uses preview language, reports no saved result, and returns the learner to the selected course dashboard.

## Responsive presentation

The dashboard keeps its dominant continue action and adds the current scenario/outcome in the launch card. Course selection remains secondary and uses obvious selected state, completion context, and accessible 44-pixel controls.

On narrow screens, the active lesson keeps the primary action in a sticky bottom action region within the safe area. The content area has sufficient bottom padding, no horizontal scrolling, concise line lengths, and a logical focus order. Revealing an answer does not force a viewport jump.

On desktop, the lesson card has a persistent context rail for scenario/path progress and a generous content column for prompts and model dialogue. This is a layout enhancement only: keyboard, touch, and response flow remain identical to mobile. Motion remains reduced for users who request it.

## Boundaries and errors

- No audio, microphone, or assessment integration is required to progress through this content slice.
- Answer reveal is separate from correctness, mastery, XP persistence, and SRS mutation.
- There is no imitation of proprietary interfaces or visual identities; visual inspiration is limited to general usability principles such as scenario focus, legible progress, and low-pressure practice.
- Missing course content, empty sessions, and invalid step IDs have deliberate recovery states and links back to the dashboard.

## Verification

Add tests before implementation for:

- the complete five-pattern original fixture structure for each course;
- resolution of a session step to its matching concept and drill, including invalid/missing IDs;
- model-answer reveal and self-check state without a mastery claim;
- course-specific scenarios and continued course switching;
- accessible primary controls and session progress; and
- narrow-mobile and desktop browser behaviour, including no horizontal overflow and the reachable primary action.

Run the focused unit tests, the full Vitest suite, lint, typecheck, production build, and the Playwright mobile/desktop checks. Inspect the final browser layouts at the configured phone and desktop widths.

## Sources and attribution boundary

The design references only high-level instructional principles from publicly described sources: practical scenario-centred chunks and controlled/free practice, guided structural reasoning, and pattern-drill practice. It does not import source material. Before shipping any external recordings, text, illustrations, or exercises, verify their specific licence and keep an attribution/provenance record.

