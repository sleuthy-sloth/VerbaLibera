/**
 * Capture app screenshots for the README and release notes.
 *
 * Usage:
 *   npm run dev -- --port 3100 -H localhost     # in one shell
 *   node scripts/screenshots/capture.mjs        # in another
 *   node scripts/screenshots/capture.mjs --base http://localhost:3000
 *
 * Writes docs/screenshots/<dir>/<name>-<width>.png
 *
 * Fails loudly. A capture run that silently produced nothing, or half a set,
 * is worse than no run: the last audit in this repo reported success while
 * every route errored because it counted problems instead of coverage. So this
 * preflights the server, records per-route errors, and prints the counts.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = argOf('--base', process.env.SHOT_BASE_URL ?? 'http://localhost:3100');
const DIR = argOf('--dir', 'warm-studio');

const VIEWPORTS = [
  // 1440x1080: tall enough that the lesson and dashboard cards are not sliced
  // through the middle by the fold, which reads as an unfinished product.
  { name: 'desktop', width: 1440, height: 1080 },
  { name: 'mobile', width: 390, height: 844 },
];

// `settle` lets a specific route wait longer: the lesson shell fetches a pack.
// `interact` drives the page into the state worth photographing. Without it,
// Listen captures a track list with no player and the lesson captures its
// intro card, both of which read as placeholders in a README.
const ROUTES = [
  { name: 'home', path: '/', settle: 1200 },
  { name: 'dashboard', path: '/dashboard', settle: 1800 },
  { name: 'courses', path: '/courses', settle: 1500 },
  { name: 'course-path', path: '/courses/french', settle: 1800 },
  {
    name: 'lesson',
    path: '/learn/english-to-french?start=1',
    settle: 2600,
    // Step 1 is an intro card, steps 2 and 3 are typed drills, and step 4 is
    // the token-ordering exercise where the learner assembles a sentence. That
    // last one is the product's actual pitch, so the capture lands there.
    interact: async (page) => {
      await page.getByRole('button', { name: /start lesson/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(1400);
      for (let step = 0; step < 3; step += 1) {
        await page.getByRole('button', { name: /continue/i }).first().click({ timeout: 5000 });
        await page.waitForTimeout(1400);
      }
    },
  },
  {
    name: 'listen',
    path: '/listen',
    settle: 2200,
    interact: async (page) => {
      await page.locator('ol li button').first().click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      // Without this the player photographs as `0:00 / 0:00`, which looks
      // broken. The track is ten minutes long; it just needs metadata.
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const audio = document.querySelector('audio');
            if (!audio) return resolve('no audio element');
            if (audio.readyState >= 1) return resolve('metadata already present');
            audio.addEventListener('loadedmetadata', () => resolve('metadata loaded'), { once: true });
            setTimeout(() => resolve('metadata timed out'), 8_000);
          }),
      );
      await page.waitForTimeout(600);
    },
  },
  { name: 'profile', path: '/you', settle: 1500 },
];

const outDir = path.join(repo, 'docs', 'screenshots', DIR);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

// Preflight: without this an unreachable server produces an empty directory and
// a cheerful exit.
try {
  const probe = await fetch(BASE, { redirect: 'manual' });
  if (probe.status >= 500) throw new Error(`HTTP ${probe.status}`);
} catch (error) {
  console.error(
    `\nNo screenshots taken. Nothing is serving ${BASE}.\n  ${String(error).slice(0, 160)}\n\n` +
      'Start the app first:\n  npm run dev -- --port 3100 -H localhost\n',
  );
  await browser.close();
  process.exit(2);
}

const captured = [];
const failed = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2, // retina: keeps text crisp when scaled in a README
    reducedMotion: 'reduce', // no mid-transition frames
    isMobile: viewport.name === 'mobile',
    hasTouch: viewport.name === 'mobile',
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const file = path.join(outDir, `${route.name}-${viewport.width}.png`);
    try {
      const response = await page.goto(BASE + route.path, { waitUntil: 'load', timeout: 45_000 });
      if (!response || response.status() >= 400) {
        throw new Error(`HTTP ${response ? response.status() : 'no response'}`);
      }
      await page.waitForTimeout(route.settle);
      // Web fonts and lazy images: without this, captures catch the fallback.
      await page.evaluate(() => document.fonts?.ready);

      // Drive the page into the state worth photographing. A missing target is
      // reported in the output line rather than swallowed: a capture of the
      // wrong state is the failure mode this exists to prevent.
      let interaction = '';
      if (route.interact) {
        try {
          await route.interact(page);
          interaction = ' (interacted)';
        } catch {
          interaction = ' (NO INTERACTION TARGET)';
        }
      }

      // Next's dev-mode indicator floats bottom-left in every capture and is
      // not part of the product. Hide it and any other dev portal chrome.
      await page.addStyleTag({
        content: 'nextjs-portal, [data-nextjs-dev-tools-button], #__next-build-watcher { display: none !important; }',
      });
      await page.waitForTimeout(150);
      await page.screenshot({ path: file });
      const kb = (fs.statSync(file).size / 1024).toFixed(0);
      captured.push(route.name);
      console.log(
        `  ${viewport.name.padEnd(7)} ${route.name.padEnd(12)} ${kb.padStart(5)} KB  ${path.relative(repo, file)}${interaction}`,
      );
    } catch (error) {
      failed.push(`${viewport.name} ${route.name}: ${String(error).split('\n')[0].slice(0, 120)}`);
      console.log(`  ${viewport.name.padEnd(7)} ${route.name.padEnd(12)} FAILED  ${String(error).split('\n')[0].slice(0, 80)}`);
    }
    await page.close();
  }
  await context.close();
}

await browser.close();

const expected = VIEWPORTS.length * ROUTES.length;
console.log(`\ncaptured ${captured.length}/${expected} screenshots into docs/screenshots/${DIR}/`);
if (failed.length) {
  console.log('\nThese did not capture:');
  for (const f of failed) console.log(`  ${f}`);
}
process.exit(failed.length ? 1 : 0);
