# Public API options

A survey of APIs from the [public-apis list](https://github.com/public-apis/public-apis) that could fit VerbaLibera, verified against each service's own documentation on 2026-09-02 (HTTPS/CORS probed live where noted).

This is an assessment only. Nothing here is integrated, no code depends on these services, and no roadmap commitment is made. Availability and free tiers change; re-verify before adopting anything.

Two standing rules shape every option below:

- No learner audio or session data may be created, retained, transmitted, or cached by the app. Any integration must either avoid learner input entirely (dictionary lookups of individual words, content sourcing) or run as a local, self-hosted sidecar like the voice service does.
- Third-party content needs compatible licensing and attribution (see the License section of the README and [asset provenance](asset-provenance.md)).

## Strong candidates

### LibreTranslate (self-hosted)

- Category: translation. HTTPS/CORS: yes (confirmed live). Auth: none when self-hosted; the managed libretranslate.com instance requires a key.
- Languages: 41, including EN↔FR and EN↔IT (confirmed via its `/languages` endpoint).
- What VerbaLibera could use it for: a server-side cross-check of authored bilingual content during authoring, or self-hosted translation for future phrasebook features — with zero learner data leaving the app.
- Constraints: AGPL-3.0. Self-hosting in a sidecar container alongside the existing voice service is the privacy-clean path; the public instance is a third-party processor.

### Free Dictionary API

- Category: dictionary. HTTPS/CORS: yes (confirmed live). Auth: none.
- Languages: English entries only.
- What VerbaLibera could use it for: browser-side word lookups — IPA phonetics, definitions, example sentences — for phrasebook tooltips on the English side of every drill. Lookups of individual words are the least privacy-sensitive calls an integration could make.
- Constraints: donation-supported; no formal license — suitable for a learning tool, but attribution is polite and the service could disappear (it would degrade gracefully to no tooltips).

### Datamuse

- Category: word relationships. HTTPS/CORS: yes (confirmed live). Auth: none.
- Languages: primarily English, with cross-language phonetic matching.
- What VerbaLibera could use it for: vocabulary drill generators — rhymes, synonyms, sound-alike patterns — as candidate material for future exercise types.
- Constraints: data derives from WordNet; acknowledgment required per its BSD-style license.

### Wiktionary REST API

- Category: dictionary. HTTPS/CORS: yes (via the `origin=*` mechanism). Auth: none.
- Languages: EN, FR, IT, and 300+ others, each with its own subdomain.
- What VerbaLibera could use it for: deeper French/Italian dictionary coverage — etymologies, grammatical tables, usage examples — that the English-only Free Dictionary API cannot provide.
- Constraints: CC BY-SA 3.0; content shown to learners must attribute Wiktionary contributors and share alike if repurposed.

### Gutendex

- Category: books/reading. HTTPS/CORS: yes. Auth: none.
- Languages: 30+, filterable to FR/IT (`?languages=fr,it`).
- What VerbaLibera could use it for: sourcing public-domain French and Italian texts as raw material for future graded-reading lessons.
- Constraints: Project Gutenberg texts are public domain; metadata is freely reusable.

### Open-Meteo

- Category: weather (travel-scenario flavor). HTTPS/CORS: yes. Auth: none. Free tier: 10,000 calls/day for non-commercial use.
- What VerbaLibera could use it for: live weather vocabulary in travel lessons ("Il fa freddo a Roma oggi") using fixed city coordinates.
- Constraints: CC BY 4.0 attribution; commercial use requires a paid plan. Do not send learner location — only static, authored city coordinates.

## Listed but not a fit today

- **Key-walled commercial dictionaries** (Collins, Merriam-Webster, Oxford) — paid subscriptions; wrong economics for an open-source preview.
- **Key-walled news APIs** (NewsData.io, GNews, NewsAPI) — free tiers too limited for production use.
- **IBM Text to Speech** — account plus paid plan required; the local Kokoro sidecar already covers TTS without any third-party call.
- **Proprietary TTS/translation SaaS from the list** (e.g., ElevenLabs-backed aggregators, managed translation endpoints) — each becomes a data processor for any text sent, free tiers are trials rather than sustained tiers, and the local sidecar already meets the current need. Revisit only if a hosted service is ever deployed.
- **Dead or inaccessible list entries** — the public-apis list contains stale rows (several translation entries returned 403/410 during verification). Confirm an endpoint is alive before planning around it.

## If we trial something

Start with the three that need no keys and no learner data: the **Free Dictionary API** for English-side tooltips, **Wiktionary** for French/Italian depth, and **self-hosted LibreTranslate** as an authoring cross-check. Any integration should follow the voice service's pattern — local sidecar or server-only route, honest degradation when the service is unavailable, and attribution committed alongside the feature.

## Decision (2026-09-02)

Typed answer checking uses local Argos Translate inside the existing voice sidecar — the self-hosted path this survey recommended for translation. No hosted API is integrated; the survey stands as written.
