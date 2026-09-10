import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Copy guard.
 *
 * 116 matches for device/account/guest/preview bookkeeping language were
 * scattered across the learner surface. The worst of it introduced the course
 * page: "0 practice results on this device · 0/25 lessons practised successfully.
 * Device practice is separate from account progress." before a single French
 * word. That is the "made by a machine" feeling, and it is copy — so it needs a
 * copy-level guard or it comes back the next time someone adds a status line.
 *
 * Rules: a banned phrase must not appear in learner-facing JSX text on the
 * screens a learner reads, and the replacements listed below are the wording the
 * app now uses instead. Notes and comments are ignored — this is about what a
 * learner reads, not what a developer wrote down.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.name.endsWith('.tsx')) found.push(full);
  }
  return found;
}

const BANNED = [
  'device practice',
  'guest practice',
  'account practice is synchronized',
  'preview progress',
  'preview lesson',
  'review item',
  'remains in review',
  'assisted practice',
  'review history',
  'independent practice',
  'practice results on this device',
  'use signed-in account',
  'session preview coming soon',
  'course workspace',
  'read-only snapshot',
];

/** Only the text a learner reads: string literals, with comments stripped. */
function visibleText(file: string): string {
  const source = readFileSync(file, 'utf8');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\/\/[^\n"'`]*$/gm, ' ');
}

describe('learner-facing copy', () => {
  it('does not narrate the app\'s storage layers or its evidence model', () => {
    const offences: string[] = [];
    for (const file of walk(SRC)) {
      const text = visibleText(file);
      const lines = text.split('\n');
      for (const phrase of BANNED) {
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(phrase)) {
            offences.push(
              `${file.replace(process.cwd() + '/', '')}:${index + 1} — "${phrase}"`,
            );
          }
        });
      }
    }
    expect(offences, `Bookkeeping language on the learner surface:\n${offences.join('\n')}`).toHaveLength(0);
  });

  it('resolves the XP-versus-no-streak contradiction', () => {
    // The landing page promises "No streak anxiety... lives... countdown... fake
    // urgency." The profile used to lead with Total XP and a streak counter.
    const profile = readFileSync(join(SRC, 'components/you/YouProfile.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(profile).not.toMatch(/Total XP/);
    expect(profile).not.toMatch(/streak/i);
    const landing = readFileSync(join(SRC, 'components/landing/LearningMethod.tsx'), 'utf8');
    expect(landing).toMatch(/streak anxiety/);
  });

  it('scans a plausible number of components', () => {
    expect(walk(SRC).length).toBeGreaterThan(40);
  });
});
