# Quiet Ink interface redesign

## Objective

Replace VerbaLibera’s Signal Pop presentation with Quiet Ink: a calm, editorial, audio-first learning interface that guides a learner through one daily path without gamified pressure. Apply the approved design handoff to the dashboard, guided-session page, and static PWA shell while preserving the existing course, progress, SRS, access-policy, and content-provenance boundaries.

## Scope

This implementation changes visual tokens, responsive layout, semantic labels, and the guided-session reveal flow. It includes the dashboard, guided session, manifest, and offline page. It does not implement the future feature roadmap: new drill kinds, Anki export, conversations, tap-to-gloss, Phrasebook persistence, offline unit caching, mastery rings, or listen-first settings.

The separately approved original-Kokoro-audio work remains its own dependency. Quiet Ink will present the audio-first control surface and use the existing `AudioPlayer` boundary where its segments are available; until static original assets are generated, it must retain an accessible unavailable-audio fallback and never imply that a clip is playable.

## Visual system

Global tokens replace the current indigo, coral, lime, radial wash, and rounded/brutalist treatment:

- Canvas `#f4f3ee`, surface `#ffffff`, ink `#1a1f1e`, deep ink `#0f1312`.
- Teal is the only functional accent: `#1e6563`, strong `#174b4a`, soft `#e4edeb`.
- Lines derive from ink at 14% and 26%; muted text derives from ink at 60%.
- `Newsreader` is the display serif, `Instrument Sans` is body text, and `IBM Plex Mono` handles labels, small metadata, and controls.
- Focus indication remains globally visible, selection uses teal, and all motion continues to honor reduced-motion preferences.

The body uses a flat canvas. Cards are disciplined surfaces with thin rules, restrained corner radii, and no drop-shadow-as-branding. Small white text appears only on the dark teal accent.

## Dashboard

`DailyPathDashboard` becomes a two-column desktop composition and a single-column mobile flow.

- The header contains the VerbaLibera wordmark, preview-progress chip, and a compact segmented course selector. The selector is generated from `progress.courses`: it uses the full course title and a stable abbreviated label derived from course data, never hardcoded French/Italian buttons. It stays keyboard-accessible and communicates the selected course with `aria-pressed`.
- The intro band contains a utility kicker, Newsreader headline, concise explanation, and the existing abstract daily-practice mark contained within the band.
- The primary “Today’s 8-minute path” card combines the unit title, course title, daily-goal progress, three compact Review/Drill/Pattern rows, time estimate, and the session CTA. The CTA only links when the selected course has both curriculum content and session data; otherwise it remains an explicit unavailable state.
- The desktop secondary column is sticky and contains exactly one Progress snapshot: total XP, practice flow, and review queue. The review count is not repeated elsewhere as a headline metric.
- On screens at or below 760px, the intro remains brief, Today becomes the first substantial content block, its CTA remains above the fold, and no component introduces horizontal scrolling.

## Guided session

`GuidedSession` has a short header (“Daily path” and “8-minute preview”), a restrained intro, and one textual stepline such as “Step 2 of 4 · Drill sprint” with a progress bar. The horizontal step rail is removed.

The active step is a thin-bordered surface with an accent-soft numeric column. It presents the step title and prompt, then two distinct learner actions:

- A ghost “Play prompt” control delegates to the existing audio-player interaction when a renderable prompt segment exists; unavailable or failed audio presents the existing clear fallback rather than false playback affordance.
- A filled “Continue” or “Submit response” control advances from the prompt turn. The model answer is never displayed inline beforehand. A separate “Reveal model answer” control makes the answer visible only after the response turn. For a real player sequence, its deliberate response-turn action remains the source of truth; the UI must not auto-reveal an answer.

The completion surface says “Path complete” and “Nothing was saved” in the quiet interface voice. It uses no lime/coral celebration and remains reduced-motion safe.

## Static PWA shell

The manifest uses the canvas color for theme and background, retains standalone display and `/` start URL, adds `id`, description, and Today/Resume-session shortcuts. It keeps the conservative static service worker unchanged. `offline.html` adopts the same Quiet Ink tokens and language without adding learner-data caching. Regenerated teal-paper icons and screenshots are deferred until actual image assets are supplied.

## Data and behavior boundaries

- Existing progress/curriculum types and server data remain unchanged.
- Course selection continues to use the existing client-local selected-course index; later persistence is outside this redesign.
- Course controls support an arbitrary number of available courses and must gracefully wrap or horizontally scroll only within the control when required by narrow width, never across the page.
- Answer visibility is local UI state and is reset whenever the learner moves to another session step.
- The design does not create, retain, transmit, or cache learner audio or session data.

## Testing and acceptance criteria

- Dashboard tests verify generic, data-driven course selection; selected-course CTA behavior; one review metric; and accessible selected control state.
- Guided-session tests verify the rail is absent, stepline/progress are present, answer text is absent before explicit reveal, fallback audio messaging is truthful, and answer state resets on step advance.
- Manifest and service-worker tests verify PWA metadata additions without broadening static caching.
- Global styles and components retain visible keyboard focus and reduced-motion behavior.
- Browser smoke tests at 1440px and 390px verify the Today CTA is prominent, desktop progress is secondary/sticky, guided sessions have no horizontal overflow, and reveal behavior is deliberate.
