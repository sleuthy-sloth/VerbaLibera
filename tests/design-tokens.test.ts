import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Token-drift guard.
 *
 * The lesson surfaces have to render standalone: `public/study.css` and the
 * portable bundle ship `study.css` and `lesson-player.css` WITHOUT
 * `globals.css`, so those files carry inline fallbacks like
 * `var(--accent, #a8511f)`. That is the same duplication that produced three
 * drifting palettes in the first place — the French lesson ran on
 * `#f5f3ee/#222e2c/#176a61`, the Italian lesson on its own `--lp-*` copy of the
 * same values, and the app shell on `#f4f3ee/#1a1f1e/#1e6563`. Nothing failed;
 * the two lesson engines simply stopped looking like the app around them.
 *
 * So: every literal fallback must equal the token it is a fallback for, and no
 * file may reference the retired material vocabulary. Duplication is allowed
 * only when it is checked.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const GLOBALS = 'src/app/globals.css';
const LESSON_FILES = [
  'src/features/course-pack/study.css',
  'src/features/course-pack/lesson-player.css',
];

/** Every stylesheet under src/, so a new file cannot opt out of the guard. */
function allStylesheets(dir = join(root, 'src')): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...allStylesheets(full));
    else if (entry.name.endsWith('.css')) found.push(full);
  }
  return found.sort();
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Comments in any syntax, so a file may name the values it forbids. */
const stripAllComments = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

/**
 * Identity-bearing files that are NOT stylesheets under `src/`.
 *
 * The guards below used to read only `src/**\/*.css`. That left a hole wide
 * enough to hide a whole second identity in: `src/app/manifest.ts` (the PWA
 * theme colour), `public/offline.html` (precached, so the first thing an
 * offline learner sees), `public/study.html` and the portable bundle (both
 * *emitted* by build scripts, so fixing the output alone silently reverts on the
 * next prebuild), and the desktop shell's HTML, which still had real glass —
 * `backdrop-filter` and gradient buttons — after the migration claimed there was
 * none left in the tree.
 *
 * Generated artifacts are excluded on purpose: `public/study.js` is a minified
 * bundle whose contents come from node_modules, and `public/study.css` is a
 * copy of a file already checked at its source.
 */
const GENERATED = new Set(['study.js', 'study.css', 'sw.js']);

function identityFiles(dir = root, out: string[] = []): string[] {
  const SKIP = new Set([
    'node_modules', 'dist', 'docs', 'sketches', 'out', 'public', // public handled below
    // Compiled desktop output: `desktop:compile` copies desktop/ui/*.html here.
    // Checking it would only ever report staleness, never a real regression.
    'desktop-dist',
  ]);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) identityFiles(full, out);
    else if (/\.(css|ts|tsx|html)$/.test(entry.name)) {
      // The guards themselves name every retired value.
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
      out.push(full);
    }
  }
  return out.sort();
}

/** Hand-written shipped HTML: the offline fallback, the manifest, the desktop shell. */
function shippedHtml(): string[] {
  const found: string[] = [];
  const pub = join(root, 'public');
  for (const entry of readdirSync(pub, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html') && !GENERATED.has(entry.name)) {
      found.push(join(pub, entry.name));
    }
  }
  const desktop = join(root, 'desktop');
  for (const entry of readdirSync(desktop, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const sub = join(desktop, entry.name);
    for (const f of readdirSync(sub, { withFileTypes: true })) {
      if (f.isFile() && f.name.endsWith('.html')) found.push(join(sub, f.name));
    }
  }
  return found.sort();
}

/** Literal `--token: #hex` declarations from the `:root` block of globals.css. */
function canonicalTokens(): Map<string, string> {
  const css = read(GLOBALS);
  const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
  const tokens = new Map<string, string>();
  for (const [, name, value] of rootBlock.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(name, value.toLowerCase());
  }
  return tokens;
}

describe('design tokens', () => {
  it('is reading real values out of globals.css', () => {
    // Break caught: a regex change silently makes every check below vacuous.
    const tokens = canonicalTokens();
    expect(tokens.size).toBeGreaterThan(8);
    expect(tokens.get('--canvas')).toBe('#fbf4e6');
    expect(tokens.get('--accent')).toBe('#a8511f');
  });

  it('keeps every fallback equal to the token it stands in for', () => {
    // EVERY stylesheet, not just the lesson pair. A first version of this guard
    // checked only those two files, and 19 stale `var(--muted-foreground,
    // #586360)` fallbacks survived across the app — each one rendering the
    // retired cool grey anywhere globals.css was not loaded.
    const tokens = canonicalTokens();
    const drift: string[] = [];
    for (const file of allStylesheets()) {
      const css = stripComments(readFileSync(file, 'utf8'));
      for (const [, name, fallback] of css.matchAll(/var\((--[a-z0-9-]+),\s*(#[0-9a-fA-F]{6})\)/g)) {
        const canonical = tokens.get(name);
        // Only compare when the token is a plain colour; composed tokens
        // (--muted-ink, --lift-sm, --focus-ring) have no single literal.
        if (!canonical) continue;
        if (canonical !== fallback.toLowerCase())
          drift.push(`${file.replace(root + '/', '')}: var(${name}, ${fallback}) but globals.css says ${canonical}`);
      }
    }
    expect(
      drift,
      `Fallbacks have drifted from the shared tokens:\n${drift.join('\n')}`,
    ).toHaveLength(0);
  });

  it('has retired the previous palettes', () => {
    // Every value the app used before Warm Studio: the shell's Quiet Ink set,
    // the two lesson palettes, and the landing page's private copy. Landing in
    // particular was a fourth palette with its own paper, a cool grey muted and
    // five soft shadows, and the guard did not look at it.
    const retired = [
      '#f4f3ee', '#f5f3ee', '#fbf9f3', // canvases / papers
      '#fffdfa', '#ffffff',            // old surfaces
      '#1a1f1e', '#0f1312', '#222e2c', // inks
      '#586360', '#536560', '#666c66', // muted
      '#1e6563', '#176a61', '#174b4a', '#e4edeb', // accents
      '#46534f',                       // cool grey-green, pre-dating every palette
      // Tailwind defaults. The welcome flow — the first screen a new learner
      // sees — was built from these, and its --color-* variables were referenced
      // with these as fallbacks and never defined, so they always won.
      '#111827', '#6b7280', '#e5e7eb', '#d1d5db', '#4f46e5', '#9ca3af', '#1f2937',
    ];
    const offenders: string[] = [];
    for (const file of allStylesheets()) {
      const css = stripComments(readFileSync(file, 'utf8'));
      for (const hex of retired)
        if (css.toLowerCase().includes(hex))
          offenders.push(`${file.replace(root + '/', '')}: ${hex}`);
    }
    expect(
      offenders,
      `Retired palette values still in use:\n${offenders.join('\n')}`,
    ).toHaveLength(0);
  });

  it('keeps the v1 lesson locals equal to the tokens they mirror', () => {
    // `study.css` declares --paper/--ink/--muted/--accent locally for the
    // offline bundle. They are aliases, not a palette.
    const css = read('src/features/course-pack/study.css');
    const block = css.slice(css.indexOf('.study {'), css.indexOf('\n}', css.indexOf('.study {')));
    const local = new Map(
      [...block.matchAll(/(--[a-z]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, n, v]) => [n, v.toLowerCase()]),
    );
    const tokens = canonicalTokens();
    expect(local.get('--paper')).toBe(tokens.get('--canvas'));
    expect(local.get('--ink')).toBe(tokens.get('--ink'));
    expect(local.get('--muted')).toBe(tokens.get('--muted-foreground'));
    expect(local.get('--accent')).toBe(tokens.get('--accent'));
  });

  it('has retired the Liquid Glass material vocabulary', () => {
    // The identity is stacked paper now: a solid edge and a hard offset. The
    // glass tokens are gone, and no stylesheet may blur a surface again.
    const retired = ['--glass-fill', '--glass-fill-strong', '--glass-edge', '--glass-blur',
                     '--glass-highlight', '--glass-shadow', '--glass-shadow-sm', '--radius-glass'];
    const offenders: string[] = [];
    for (const file of [GLOBALS, ...LESSON_FILES]) {
      const css = read(file);
      for (const token of retired)
        if (css.includes(token)) offenders.push(`${file}: ${token}`);
    }
    expect(offenders, `Retired glass vocabulary still referenced:\n${offenders.join('\n')}`).toHaveLength(0);
  });

  it('has retired the previous palettes outside the stylesheets too', () => {
    // The stylesheet guard above was scoped to src/, and a whole second
    // identity lived outside it: the PWA theme colour, the precached offline
    // page, and two build scripts that *emit* HTML. This checks the files the
    // first version never opened.
    //
    // Deliberately narrower than the list above: `#ffffff` and `#fbf9f3` are too
    // generic to assert on outside CSS, and the Tailwind greys `#9ca3af`,
    // `#d1d5db`, `#1f2937` are not distinctive enough to be conclusive.
    const retired = [
      '#f4f3ee', '#f5f3ee', '#1a1f1e', '#0f1312', '#222e2c',
      '#586360', '#536560', '#666c66',
      '#1e6563', '#176a61', '#174b4a', '#e4edeb',
      '#46534f', '#111827', '#6b7280', '#e5e7eb', '#4f46e5',
      '#768a82', '#899b95', '#8a7c62', '#c2662f',
    ];
    const files = [...identityFiles(), ...shippedHtml()];
    // Break caught: the walker silently returns nothing and every check passes.
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith('manifest.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('offline.html'))).toBe(true);

    const offenders: string[] = [];
    for (const file of files) {
      const text = stripAllComments(readFileSync(file, 'utf8')).toLowerCase();
      for (const hex of retired) if (text.includes(hex)) offenders.push(`${file.replace(root + '/', '')}: ${hex}`);
    }
    expect(offenders, `Retired palette values outside the stylesheets:\n${offenders.join('\n')}`).toHaveLength(0);
  });

  it('keeps blur out of the identity and gradients out of the shipped pages', () => {
    // Warm Studio's depth is a hard offset with zero blur, so the only valid
    // `backdrop-filter` is one switching itself off. The desktop setup screen
    // kept `blur(22px) saturate(1.8)` and gradient buttons through the whole
    // migration, because nothing read `desktop/`.
    //
    // Gradients are asserted on the shipped pages only. `session.module.css`
    // has one `linear-gradient(transparent → --canvas)` scrim, which is a mask
    // rather than a decorative fill; it is knowingly allowed here.
    const blurOffenders: string[] = [];
    for (const file of [...identityFiles(), ...shippedHtml()]) {
      const text = stripAllComments(readFileSync(file, 'utf8'));
      for (const [, value] of text.matchAll(/backdrop-filter:\s*([^;}]+)/g)) {
        if (value.trim() !== 'none' && value.trim() !== 'none !important') {
          blurOffenders.push(`${file.replace(root + '/', '')}: backdrop-filter: ${value.trim()}`);
        }
      }
    }
    expect(blurOffenders, `Blurred surfaces are back:\n${blurOffenders.join('\n')}`).toHaveLength(0);

    const gradientOffenders: string[] = [];
    for (const file of shippedHtml()) {
      const text = stripAllComments(readFileSync(file, 'utf8'));
      if (/gradient\(/.test(text)) gradientOffenders.push(file.replace(root + '/', ''));
    }
    expect(
      gradientOffenders,
      `Shipped pages use a gradient; the identity is flat:\n${gradientOffenders.join('\n')}`,
    ).toHaveLength(0);
  });
});
