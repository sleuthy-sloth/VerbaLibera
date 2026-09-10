# Recent audio implementation review

Reviewed source at commits `9fc29ca` and `8e8e574`, including the Italian clip manifest, Listen catalog/player, generated pack integration, portable collector, and offline service worker. This is a code and authored-text review, not subjective listening or native-speaker QA.

## Findings

1. **High — the Italian read-along is not a faithful transcript.** `src/features/listen/tracks.ts:129` pairs the request introduction with “Vorrei due etti di prosciutto, per favore”, while `services/voice/scripts/italian-market-listen.json:151` authors the actual clip as “Due etti di prosciutto, per favore.” The final pears challenge (`tracks.ts:169`) displays “Lo prendo, grazie” rather than the authored “Vorrei un chilo di pere, per favore.” Several intermediate target turns are omitted, including the ham quantity, cheese quantity, grape price question, and final pear request. The renderer labels these sections “Read along (transcript)” (`src/components/listen/ListenPlayer.tsx:52`), so learners receive contradictory text rather than an explicitly abbreviated outline. Generate ordered transcript turns from the same clip source used for synthesis, and test that every spoken clip appears once in order. Preserve translations as separate display metadata.

2. **Medium — Italian dialogue framing contradicts the authored exchange.** The English setup says Elena asks the price of grapes, but the following price clip asks “Quanto costano le pesche?” (peaches; `services/voice/scripts/italian-market-listen.json:203`). It also promises greeting, vendor answer, then order, while the authored order clip precedes the vendor greeting (`:186–203`). Align setup and spoken turn order; update audio and provenance together rather than editing only the displayed text.

3. **Medium — downloading a course does not supply the dedicated Listen experience after a fresh offline launch.** `src/app/listen/page.tsx` promises “download the course once, then press play.” However, `public/sw.js:51–53` intentionally sends failed navigation to `offline.html`, whose links open `study.html`; `src/features/course-pack/offline-entry.tsx` mounts the study workspace, which has no dedicated Listen catalog/player. Italian's long track is correctly listed in pack media (`courses/italian/manifest.json:1372`) and therefore saved by `storage.ts:270` and embedded by `scripts/portable/content.ts`. It remains accessible through the market activity, subject to lesson prerequisites, but the promised standalone audio flow is missing offline. French's existing long track is precached by the service worker but is absent from French pack media, so the portable collector also excludes that track. Expose the same local Listen catalog through the downloaded/portable workspace and include all registered playable tracks in pack media; avoid caching personalized Next HTML as a shortcut.

4. **Medium — runtime audio caching accepts partial responses it cannot store.** `public/sw.js:58–60` sends every successful audio response to `Cache.put`, including HTTP 206 responses from browser range requests; Cache API rejects status 206. The downloaded Italian pack does store a complete response through the explicit install path, so this finding does not imply that its downloaded file is absent. Guard caching to complete responses, and provide/test range responses from complete cached media if seeking support is required. Current worker tests cover ordinary responses only; no offline audio range scenario is exercised.

## Work that is already useful

- The Italian pilot is an actual static 450.03-second MP3 with clip-level digests and authoring provenance, rather than a placeholder URL.
- The portable collector now recognizes MP3/M4A/OGG MIME types and verifies pack media hashes before embedding.
- The generated artifacts commit updates shipped v2 packs and the offline player bundle alongside authored content.
- Listen completion is logged as listened, without inventing mastery or a pronunciation score.

For the next language expansion, use one authored source for synthesis, transcript order, pause durations, pack media, and catalog metadata. Verify media integrity and offline reachability separately from linguistic and acoustic review.
