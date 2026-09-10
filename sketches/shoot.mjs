/**
 * Sketch harness — two jobs:
 *
 *   1. assert every variant FITS a 390x844 phone in both states (question and
 *      answered), with no overflow, no overlapping blocks, and the primary
 *      action above the fold;
 *   2. shoot each variant plus one composite of all three.
 *
 * Why the assertion: the first build of these sketches looked fine in a
 * screenshot and was actually broken. `display: flex` shrinks flex items, so a
 * panel with `overflow: hidden` (which the glass material needs) silently
 * compressed and clipped its last line of text, and a hidden feedback sheet
 * still occupied 43px of layout and pushed the footer into it. Neither shows up
 * as an error anywhere — only as "that looks a bit tight" in a picture.
 *
 * Run: node sketches/shoot.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const VARIANTS = ['001-glass-material', '002-broadsheet', '003-warm-studio'];
const PHONE = { width: 390, height: 844 };

const measure = (page) =>
  page.evaluate(() => {
    const screen = document.querySelector('.screen');
    const blocks = [...screen.querySelectorAll(':scope > *')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          cls: el.className.baseVal ?? el.className.split(' ')[0] ?? el.tagName,
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      // A `display: none` element has an all-zero rect at 0,0. That is not an
      // overlap, it is an element that is not in the layout.
      .filter((b) => b.w > 0 && b.h > 0);

    let overlap = null;
    for (let i = 1; i < blocks.length; i += 1)
      if (blocks[i].top < blocks[i - 1].bottom - 1)
        overlap = `${blocks[i - 1].cls} / ${blocks[i].cls}`;

    const box = screen.getBoundingClientRect();
    const last = blocks[blocks.length - 1];
    return {
      overflow: screen.scrollHeight - screen.clientHeight,
      overlap,
      aboveFold: Math.round(box.bottom - last.bottom),
    };
  });

const verdict = (m) =>
  m.overflow <= 1 && !m.overlap && m.aboveFold >= 0 ? 'ok' : 'FAIL';

const browser = await chromium.launch();
let failures = 0;

for (const variant of VARIANTS) {
  const ctx = await browser.newContext({ viewport: { width: 460, height: 914 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`file://${path.join(ROOT, variant, 'index.html')}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const question = await measure(page);
  await page.locator('.phone').screenshot({ path: path.join(ROOT, variant, 'state-question.png') });

  await page.getByRole('button').click();
  await page.waitForTimeout(900);
  const answered = await measure(page);
  await page.locator('.phone').screenshot({ path: path.join(ROOT, variant, 'state-feedback.png') });

  for (const [state, m] of [['question', question], ['answered', answered]]) {
    if (verdict(m) !== 'ok') failures += 1;
    console.log(`${variant}  ${state}=${verdict(m)} ${JSON.stringify(m)}`);
  }
  await ctx.close();
}

// One composite so all three can be compared (and reviewed) as a single image.
const ctx = await browser.newContext({ viewport: { width: 1420, height: 1060 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`file://${path.join(ROOT, 'compare.html')}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(900);
for (const frame of page.frames()) {
  const button = frame.locator('button.go');
  if (await button.count()) {
    await button.click();
    await page.waitForTimeout(450);
  }
}
await page.waitForTimeout(700);
const row = await page.locator('.row').boundingBox();
await page.screenshot({
  path: path.join(ROOT, 'compare-feedback.png'),
  clip: { x: 0, y: 0, width: 1420, height: Math.ceil(row.y + row.height + 30) },
});
await ctx.close();
await browser.close();

console.log(failures === 0 ? '\nall variants fit' : `\n${failures} state(s) do not fit`);
process.exit(failures === 0 ? 0 : 1);
