import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The visual foundation.
 *
 * Rewritten from `quiet-ink-global-styles.test.ts` when the app moved to Warm
 * Studio. The old file pinned the previous identity's hexes; this pins the new
 * one, and keeps the load-bearing part of the original — that the accessibility
 * rules and the font roles survive any restyle. A design change should have to
 * argue with this test, not slip past it.
 */

/**
 * Comments are stripped before asserting, because this file's whole job is to
 * name the values it forbids — `globals.css` documents why `#8a7c62` is gone,
 * and that documentation must not read as a usage. `tests/type-scale.test.ts`
 * strips comments for the same reason.
 */
const stripComments = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, ' ');

async function foundation(): Promise<string> {
  return stripComments(
    await readFile(path.join(process.cwd(), 'src/app/globals.css'), 'utf8'),
  );
}

describe('Warm Studio global styles', () => {
  it('uses the approved Warm Studio tokens and font roles', async () => {
    const css = await foundation();

    expect(css).toContain('--canvas: #fbf4e6');
    expect(css).toContain('--surface: #fffdf7');
    expect(css).toContain('--ink: #2f2a24');
    expect(css).toContain('--ink-deep: #231e18');
    expect(css).toContain('--accent: #a8511f');
    expect(css).toContain('--accent-strong: #8f4318');
    expect(css).toContain('--accent-soft: #f6e3cd');

    // Warm Studio sets description in Fraunces; the previous identity used
    // Newsreader, which is no longer loaded at all.
    expect(css).toContain('--font-display: var(--font-fraunces)');
    expect(css).toContain('--font-body: var(--font-instrument-sans)');
    expect(css).toContain('--font-utility: var(--font-ibm-plex-mono)');

    // Depth is stacked paper: a solid edge and a hard offset.
    expect(css).toContain('--stock: #fffdf7');
    expect(css).toContain('--edge: #2f2a24');
    expect(css).toContain('--lift: 4px 4px 0 var(--edge)');
  });

  it('refuses the material and the colours this identity replaced', async () => {
    const css = await foundation();

    // No blur, no translucency, no gradient anywhere in the foundation. The one
    // permitted `backdrop-filter` is the `none !important` override for users
    // who ask their OS for more contrast.
    expect(css).not.toMatch(/backdrop-filter:\s*blur/);
    expect(css).not.toMatch(/linear-gradient|radial-gradient/);
    expect(css).not.toContain('--glass-');
    expect(css).not.toContain('--radius-glass');
    expect(css).not.toContain('--font-newsreader');

    // Colours that failed WCAG AA in the design pass: #c2662f is 3.94:1 under
    // white text and #8a7c62 is 3.73:1 on the canvas.
    expect(css).not.toContain('#c2662f');
    expect(css).not.toContain('#8a7c62');
  });

  it('keeps the accessibility rules a restyle must not drop', async () => {
    const css = await foundation();
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('prefers-contrast: more');
    expect(css).toContain('--text-min: 0.75rem');
  });
});
