/**
 * Route-level accessibility audit.
 *
 * Runs axe-core against every learner-facing route at desktop and mobile
 * viewports, and reports WCAG 2.0/2.1/2.2 A+AA violations plus the tab-order
 * and structure facts that axe cannot check.
 *
 * Usage:
 *   npm run dev -- --port 3100 -H localhost      # in one shell
 *   node scripts/a11y/route-audit.mjs            # in another
 *   node scripts/a11y/route-audit.mjs --json out.json
 *
 * Exits 1 when violations are found, so it is usable as a CI gate.
 * This is the audit that produced docs/superpowers/plans/2026-09-09-accessibility-and-navigation-review.md.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const AXE = path.join(repo, 'node_modules/axe-core/axe.min.js');
const BASE = process.env.A11Y_BASE_URL ?? 'http://localhost:3100';
const jsonFlag = process.argv.indexOf('--json');
const jsonOut = jsonFlag >= 0 ? process.argv[jsonFlag + 1] : null;

const ROUTES = [
  ['/', 'Home'],
  ['/dashboard', 'Dashboard'],
  ['/courses/french', 'Course page (fr)'],
  ['/courses/italian', 'Course page (it)'],
  ['/learn/english-to-french', 'Guided session'],
  ['/learn/english-to-french/placement', 'Placement'],
  ['/learn/english-to-french/plan', 'Study plan'],
  ['/listen', 'Listen'],
  ['/you', 'You'],
  ['/login', 'Login'],
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const browser = await chromium.launch();
const records = [];
let violationCount = 0;
const errored = [];

// Preflight. Without this, an unreachable server makes every route throw, the
// loop below records the error and counts no violations, and the script prints
// "No axe violations" and exits 0 — a green result for an audit that never ran.
try {
  const probe = await fetch(BASE, { redirect: 'manual' });
  if (!probe.ok && probe.status >= 500) throw new Error(`HTTP ${probe.status}`);
} catch (error) {
  console.error(`\nNo audit ran. Nothing is serving ${BASE}.\n  ${String(error).slice(0, 160)}\n\nStart the app first:\n  npm run dev -- --port 3100 -H localhost\n`);
  await browser.close();
  process.exit(2);
}

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.name === 'mobile',
    hasTouch: viewport.name === 'mobile',
  });

  for (const [route, label] of ROUTES) {
    const page = await context.newPage();
    const record = { viewport: viewport.name, route, label };
    try {
      const response = await page.goto(BASE + route, { waitUntil: 'load', timeout: 45_000 });
      await page.waitForTimeout(1400);
      record.status = response?.status();
      record.finalUrl = page.url();

      await page.addScriptTag({ path: AXE });
      const results = await page.evaluate(
        (tags) =>
          window.axe.run(document, {
            resultTypes: ['violations', 'incomplete'],
            runOnly: { type: 'tag', values: tags },
          }),
        TAGS,
      );

      record.violations = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.length,
        targets: violation.nodes.slice(0, 4).map((node) => ({
          target: node.target.join(' '),
          summary: (node.failureSummary ?? '').split('\n').filter(Boolean).slice(0, 2).join(' | '),
        })),
      }));
      record.incomplete = results.incomplete.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.length,
      }));

      record.structure = await page.evaluate(() => {
        const text = (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
        return {
          title: document.title,
          lang: document.documentElement.lang,
          h1Count: document.querySelectorAll('h1').length,
          headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({
            level: Number(h.tagName[1]),
            text: text(h),
            hidden: h.offsetParent === null,
          })),
          landmarks: [...document.querySelectorAll('main,nav,header,footer,aside,form')].map((el) => ({
            tag: el.tagName.toLowerCase(),
            name: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || null,
          })),
          unlabelledInteractive: [...document.querySelectorAll('button,a,input,select,textarea,[role=button]')]
            .filter((el) => {
              const content = (el.textContent ?? '').trim();
              return (
                !content &&
                !el.getAttribute('aria-label') &&
                !el.getAttribute('aria-labelledby') &&
                !el.getAttribute('title') &&
                !el.getAttribute('alt')
              );
            })
            .map((el) => el.outerHTML.slice(0, 120)),
          inputs: [...document.querySelectorAll('input,select,textarea')].map((input) => ({
            tag: input.tagName.toLowerCase(),
            type: input.getAttribute('type'),
            hasLabel: input.labels?.length > 0,
            ariaLabel: input.getAttribute('aria-label'),
          })),
        };
      });

      // Tab order: axe cannot tell you a keyboard user only has three stops.
      record.tabOrder = [];
      for (let i = 0; i < 14; i += 1) {
        await page.keyboard.press('Tab');
        record.tabOrder.push(
          await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return { tag: 'body', text: '' };
            const box = el.getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 45),
              aria: el.getAttribute('aria-label'),
              href: el.getAttribute('href'),
              visible: box.width > 0 && box.height > 0,
            };
          }),
        );
      }
      violationCount += record.violations.length;
    } catch (error) {
      record.error = String(error).slice(0, 300);
      errored.push(`${viewport.name} ${route}`);
    }
    records.push(record);
    const status = record.error ? 'ERROR' : `${(record.violations ?? []).length} violation type(s)`;
    console.log(`${viewport.name.padEnd(7)} ${String(record.status).padEnd(4)} ${route.padEnd(28)} ${status}`);
    await page.close();
  }
  await context.close();
}

await browser.close();

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(records, null, 2));
  console.log(`\nwrote ${jsonOut}`);
}

// An audit that could not run its routes is not a passing audit. Counting only
// violations meant an unreachable server produced "No axe violations" and exit
// 0 — a green badge for zero coverage.
const ran = records.length - errored.length;

// axe's `incomplete` results are the ones it could not decide. For contrast that
// means it could not resolve the effective background — which is what happens
// with `color-mix()`, used throughout the Warm Studio palette, and with text
// over a background image. Reporting only "0 violations" implies those elements
// were verified. They were not.
const undetermined = records.reduce(
  (sum, record) => sum + (record.incomplete ?? []).reduce((n, item) => n + item.nodes, 0),
  0,
);

if (errored.length) {
  console.log(`\n${errored.length} of ${records.length} route/viewport combinations did not run:`);
  for (const entry of errored) console.log(`  ${entry}`);
}

if (errored.length && ran === 0) {
  console.log('\nNo audit ran at all.');
  process.exit(2);
}
if (errored.length || violationCount) {
  console.log(
    `\n${violationCount} route(s) with violations; ${ran}/${records.length} combinations ran.`,
  );
  process.exit(1);
}
console.log(
  `\nNo axe violations across all ${ran} route/viewport combinations. Tab order and structure are in the JSON if you asked for it.`,
);
if (undetermined) {
  console.log(
    `\nNot verified: ${undetermined} node(s) came back "incomplete", where axe could not ` +
      'determine the effective colour. Contrast over `color-mix()` and over background ' +
      'images lands here. Check those by hand — they are unknown, not passing.',
  );
}
process.exit(0);
