# Asset provenance

All assets in this document are original VoxLibre project assets. They were generated with the built-in image-generation tool, visually inspected before being placed in `public/`, and have no third-party source material, logos, mascots, or embedded text.

## Quiet Ink interface screenshots

- **Captured:** 2026-09-02
- **Tool:** Playwright Chromium against the locally running app (`next dev`, port 3100)
- **Files:** `docs/screenshots/quiet-ink-dashboard-desktop.png`, `docs/screenshots/quiet-ink-dashboard-mobile.png`, `docs/screenshots/quiet-ink-session-desktop.png`, `docs/screenshots/quiet-ink-session-mobile.png`
- **Intended use:** README gallery and verification evidence for the Quiet Ink redesign.
- **Status:** live captures of the app itself; no third-party source material. The earlier `dashboard-*.png` / `session-*.png` captures show the previous interface and are retained as historical evidence referenced by the superpowers plans.

## Asset status under Quiet Ink

The two generated assets below were produced for the earlier Signal Pop palette (coral, lime, indigo). The approved Quiet Ink spec defers regenerated teal-paper artwork until new image assets are supplied, so both remain in use as-is: the PWA icon in `src/app/manifest.ts` and the daily-practice illustration on the dashboard.

## PWA icon source

- **Generated:** 2026-08-31
- **Tool:** Built-in image generation
- **Selected source:** `public/brand/voxlibre-app-icon-source.png` (1254 × 1254)
- **Prompt:**

  ```text
  Use case: logo-brand
  Asset type: PWA app-icon source and dashboard visual system
  Primary request: an original abstract speech-wave emblem for VoxLibre: a coral curved speech wave and a small lime motion accent inside a rounded indigo square, clean high-contrast silhouette, friendly but adult, premium mobile-app icon
  Style/medium: polished contemporary raster illustration, simple geometric forms
  Color palette: Ink #20233D, Indigo #7068FF, Coral #FF765F, Lime #B8F266, Cloud #F8F7FF
  Constraints: no text, no letters, no faces, no animals, no brand resemblance, no watermark, preserve a large safe margin around the symbol
  ```

- **Derived files:**
  - `public/icons/voxlibre-192.png` — regular 192 × 192 PWA icon.
  - `public/icons/voxlibre-512.png` — regular 512 × 512 PWA icon.
  - `public/icons/voxlibre-maskable-512.png` — 512 × 512 maskable PWA icon. The source’s Cloud background and generous inset preserve a safe zone without transparency.
- **Intended use:** browser/app installation metadata in `src/app/manifest.ts`.
- **Status:** original generated asset; no third-party source.

## Daily practice illustration

- **Generated:** 2026-08-31
- **Tool:** Built-in image generation
- **Selected source:** `public/illustrations/daily-practice.png` (1536 × 1024)
- **Prompt:**

  ```text
  Use case: dashboard illustration for a language-learning app.
  Asset type: premium editorial raster illustration, landscape composition.
  Primary request: an original abstract rhythm of learning: layered coral, lime, and indigo speech arcs, small sound-wave dots, and rounded study cards travelling across an off-white Cloud backdrop. The composition should feel energetic yet calm and adult—like a visual companion for a daily language-practice path.
  Style/medium: polished contemporary geometric raster illustration, clean overlapping forms, subtle depth, no outlines unless essential.
  Color palette: Ink #20233D, Indigo #7068FF, Coral #FF765F, Lime #B8F266, Cloud #F8F7FF.
  Constraints: no text, no letters, no faces, no people, no animals, no brand resemblance, no watermark. Leave quiet negative space around the edge. Wide 3:2 landscape framing.
  ```

- **Intended use:** decorative support for the Daily Path dashboard. It has empty alternative text because all instructional meaning is carried by adjacent text and controls.
- **Status:** original generated asset; no third-party source.
