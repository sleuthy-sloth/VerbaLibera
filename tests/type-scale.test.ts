import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Type-floor guard.
 *
 * The app shipped several labels below any readable size: the language-switcher
 * label rendered at 0.58rem (9.3px) on desktop and 0.54rem (8.6px) on mobile,
 * the /you eyebrow at 0.62rem (9.9px), and course-path meta at 11px. On a phone,
 * reading an unfamiliar language, that is not a stylistic choice — it is a
 * legibility failure for exactly the audience the app is for.
 *
 * Floor: 0.75rem (12px).
 */

const REM_FLOOR = 0.75;
const PX_FLOOR = 12;

function findStylesheets(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findStylesheets(full));
    else if (entry.name.endsWith('.css')) found.push(relative(process.cwd(), full));
  }
  return found;
}

const stylesheets = findStylesheets(join(process.cwd(), 'src'));

type Offence = { file: string; line: number; text: string; size: string };

function offenders(): Offence[] {
  const found: Offence[] = [];
  for (const file of stylesheets) {
    const source = readFileSync(file, 'utf8');
    // Strip comments so an explanatory comment about a past small size does not
    // register as a live declaration.
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
    stripped.split('\n').forEach((line, index) => {
      const match = /font(?:-size)?\s*:[^;]*?(?<![\d.])(\d*\.?\d+)(rem|px|em)/g;
      for (const hit of line.matchAll(match)) {
        const value = Number(hit[1]);
        const unit = hit[2];
        const tooSmall =
          ((unit === 'rem' || unit === 'em') && value < REM_FLOOR) ||
          (unit === 'px' && value < PX_FLOOR);
        if (tooSmall) {
          found.push({ file, line: index + 1, text: line.trim().slice(0, 120), size: `${value}${unit}` });
        }
      }
    });
  }
  return found;
}

describe('type scale', () => {
  it('never sets readable text below the 12px floor', () => {
    const small = offenders();
    const report = small.map((item) => `${item.file}:${item.line} (${item.size}) ${item.text}`).join('\n');
    expect(small, `Text below the ${REM_FLOOR}rem / ${PX_FLOOR}px floor:\n${report}`).toHaveLength(0);
  });

  it('finds the stylesheets it claims to be checking', () => {
    // Break caught: a walker change silently makes the guard above vacuous.
    expect(stylesheets.length).toBeGreaterThan(10);
    expect(stylesheets).toContain(join('src', 'app', 'globals.css'));
  });
});
