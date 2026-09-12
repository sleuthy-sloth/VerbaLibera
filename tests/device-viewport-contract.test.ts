import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// The layout is the only place the viewport contract is declared, and importing
// it pulls in `next/font/google`, which needs a Next build to resolve. The fonts
// have nothing to do with this contract, so they are stubbed; everything else is
// the real module.
vi.mock('next/font/google', () => {
  const font = () => ({ variable: '', className: '', style: {} });
  return { Fraunces: font, IBM_Plex_Mono: font, Instrument_Sans: font };
});

import { viewport } from '@/app/layout';

/**
 * The half of physical-device QA a machine can hold.
 *
 * `docs/device-qa-checklist.md` is the runbook for the iPhone and installed-PWA
 * pass, and most of it needs a person holding a phone: installing, going offline,
 * the lock screen, the home indicator, real touch. This file is the other half —
 * the facts that are *declarations in the repository*, which a device pass would
 * otherwise be the first thing to notice:
 *
 * - the viewport metadata a notched iPhone reads before it resolves safe areas;
 * - the standalone offline shell matching the app's own viewport behaviour;
 * - every surface that pins content to the bottom of the viewport accounting for
 *   the home indicator.
 *
 * A green run here is not a device pass. It is the set of preconditions that make
 * one worth doing; the checklist says which observations are still missing.
 */

const ROOT = process.cwd();

function cssFiles(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) out.push(...cssFiles(relative));
    else if (entry.name.endsWith('.css')) out.push(relative);
  }
  return out;
}

/**
 * Surfaces that pin content to the viewport's bottom edge, and why each one
 * needs the home indicator handled.
 *
 * The scan below is what keeps this list honest: a file that starts pinning to
 * the bottom edge without appearing here fails, so a new floating control cannot
 * ship sitting under the home indicator on a notched phone.
 */
const BOTTOM_PINNED = {
  'src/components/nav/bottom-tabs.module.css': 'the floating tab capsule',
  'src/components/ui/toast.module.css': 'the toast that rises above the tabs',
  'src/components/session/session.module.css': 'the practice action bar',
  'src/features/course-pack/study.css': 'the offline and portable shell',
  'src/app/globals.css': 'the document padding the tab capsule floats over',
} as const;

describe('the device viewport contract', () => {
  it('opts into safe areas, and leaves zoom available', () => {
    // Break caught: an installed app that cannot resolve env(safe-area-inset-*)
    // puts the tab capsule under the home indicator, and a locked scale factor
    // takes pinch-zoom away from everyone who needs it.
    expect(viewport.width).toBe('device-width');
    expect(viewport.initialScale).toBe(1);
    expect(viewport.viewportFit).toBe('cover');
    expect(viewport.maximumScale).toBeUndefined();
    expect(viewport.userScalable).toBeUndefined();
  });

  it('gives the standalone offline page the same viewport behaviour', () => {
    // `public/offline.html` is served by the service worker with no stylesheet
    // and no app shell around it, so it carries its own head. It shipped without
    // viewport-fit, which letterboxes the page on a notched phone while every
    // app route paints edge to edge.
    const html = readFileSync(path.join(ROOT, 'public', 'offline.html'), 'utf8');
    const meta = html.match(/<meta name="viewport" content="([^"]+)"/);
    expect(meta, 'offline.html declares a viewport').not.toBeNull();
    expect(meta![1]).toContain('width=device-width');
    expect(meta![1]).toContain('viewport-fit=cover');
    expect(meta![1]).not.toMatch(/user-scalable\s*=\s*no/);
    expect(meta![1]).not.toMatch(/maximum-scale\s*=\s*1(?![0-9])/);
    // And it centres its content inside those insets rather than ignoring them.
    expect(html).toContain('env(safe-area-inset-bottom)');
    expect(html).toContain('env(safe-area-inset-top)');
  });

  it('handles the home indicator on every surface that pins to the bottom edge', () => {
    for (const [file, reason] of Object.entries(BOTTOM_PINNED)) {
      const css = readFileSync(path.join(ROOT, file), 'utf8');
      expect(
        css.includes('env(safe-area-inset-bottom)'),
        `${file} (${reason}) declares no bottom safe-area inset`,
      ).toBe(true);
    }
    // Nothing new may pin to the bottom edge of the viewport without being listed
    // above. `position: fixed` is the test for that: `absolute` is relative to an
    // ancestor, and this codebase uses it for things inside a control (the select
    // chevron), which no home indicator can reach.
    const pinned = cssFiles('src')
      .filter((file) => /position:\s*fixed[\s\S]*?bottom:/.test(readFileSync(path.join(ROOT, file), 'utf8')))
      .filter((file) => !(file in BOTTOM_PINNED));
    expect(pinned, 'bottom-pinned CSS that handles no safe-area inset').toEqual([]);
  });
});
