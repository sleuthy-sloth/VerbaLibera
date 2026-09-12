import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { CourseWorkspace } from '@/features/course-pack/CourseWorkspace';
import { createMemoryLessonPractice, type CourseEnvironment } from '@/features/course-pack/environment';
import { migratePackV1ToV2, normalizePack } from '@/features/course-pack/normalize-pack';
import { makeLegacyRawPack } from './fixtures/lesson-variety';
import { validateV2Pack } from '@/features/course-pack/schema-v2';
import type { RuntimePack } from '@/features/course-pack/lesson-runtime';

/**
 * Flip rehearsal (roadmap 2B).
 *
 * `tests/migrated-pack-parity.test.ts` proves the migration is
 * *identical*: same lessons, same reachable activities, same media hashes. That
 * is necessary and not sufficient, because identical runtime output is not the
 * same claim as "the course still runs" — the French flip needed a compensating
 * think-first gate for exactly that reason.
 *
 * Two halves:
 *
 * - **A pack still at v1.** Portuguese and Spanish have both waited in this slot and
 *   both have flipped, so the rehearsal now migrates the fixture — a real
 *   three-lesson A1 Spanish starter — in memory, with nothing on disk touched, and
 *   walks it the way a learner does. If a flip would break a course, it breaks here
 *   first.
 * - **Packs already flipped** (French, German, Spanish): walk the pack that is on disk,
 *   because the rehearsal has been replaced by the real thing and the claim now
 *   is that the stored file still runs.
 *
 * It also walks the *unflipped* pack through the legacy shell, because the flip
 * has to leave the old engine working too (learner progress and old-pack replay
 * are keyed to it).
 */

const FIXTURE = 'fixture';
const PENDING = [FIXTURE] as const;
const FLIPPED = ['french', 'german', 'spanish'] as const;

function readRaw(language: string): Record<string, unknown> {
  return language === FIXTURE
    ? makeLegacyRawPack()
    : (JSON.parse(
        readFileSync(join(process.cwd(), 'courses', language, 'manifest.json'), 'utf8'),
      ) as Record<string, unknown>);
}

function environmentFor(pack: RuntimePack): CourseEnvironment {
  return {
    capabilities: {
      accounts: false,
      synchronization: false,
      offlineInstall: false,
      hostedNavigation: false,
    },
    practice: {
      getDurability: () => 'temporary',
      subscribeDurability: () => () => {},
      read: async () => [],
      write: async () => {},
    },
    lessonPractice: createMemoryLessonPractice(),
    loadPack: vi.fn(),
    loadCourse: async () => pack,
    resolveMedia: (url) => url,
  };
}

/** Open the first lesson, answer the first activity, see an outcome. */
async function walkFirstLesson(pack: RuntimePack): Promise<void> {
  render(<CourseWorkspace environment={environmentFor(pack)} />);
  const path = await screen.findByRole('navigation', { name: 'Course path' });
  expect(path).toBeInTheDocument();

  // Every lesson is still on the path, and the first one is open: a flip that
  // locked the course behind a prerequisite it invented would fail here.
  for (const lesson of pack.lessons) {
    expect(screen.getByRole('button', { name: lesson.title })).toBeInTheDocument();
  }
  const first = screen.getByRole('button', { name: pack.lessons[0].title });
  await waitFor(() => expect(first).toBeEnabled());
  await userEvent.click(first);
  await userEvent.click(await screen.findByRole('button', { name: 'Begin practice' }));

  // The lesson opens on an information step; get past them to the first thing a
  // learner actually answers.
  for (let guard = 0; guard < 6; guard += 1) {
    const info = screen.queryByRole('button', { name: 'Continue' });
    if (!info) break;
    await userEvent.click(info);
  }

  // The first practice surface, whichever kind the authored content uses —
  // asserting a specific kind would be asserting the content, not the flip.
  const radios = screen.queryAllByRole('radio');
  const textbox = screen.queryByLabelText(/^(Your answer|Missing word)$/);
  const bank = screen.queryAllByRole('button', { name: /^Add / });
  if (radios.length > 0) {
    await userEvent.click(radios[0]);
  } else if (textbox) {
    // Any answer will do: what is being checked is that the graded surface
    // exists and responds, not that this test can answer the language.
    await userEvent.type(textbox, 'test');
  } else if (bank.length > 0) {
    for (const token of bank) await userEvent.click(token);
  } else {
    throw new Error(`no answerable surface rendered for ${pack.id}`);
  }

  // Answering produces an outcome rather than silence.
  await userEvent.click(screen.getByRole('button', { name: /^Check/ }));
  await waitFor(() =>
    expect(document.querySelector('[role="status"][data-outcome]')).not.toBeNull(),
  );
}

describe.each(PENDING)('%s: a flip has to keep the course usable', (language) => {
  it('runs the v2 shell over the migrated pack, with the manifest untouched', async () => {
    const raw = readRaw(language);
    expect(raw.schemaVersion).toBe(1);
    const migrated = migratePackV1ToV2(raw);
    expect(() => validateV2Pack(migrated)).not.toThrow();
    await walkFirstLesson(normalizePack(migrated));
  });

  it('keeps the unflipped pack running in the legacy shell', async () => {
    // The flip must not be the only path: progress and replay for a learner who
    // never upgrades are keyed to the v1 engine.
    const pack = normalizePack(readRaw(language));
    expect(pack.schemaVersion).toBe(1);
    render(<CourseWorkspace environment={environmentFor(pack)} />);
    const first = await screen.findByRole('button', { name: pack.lessons[0].title });
    await waitFor(() => expect(first).toBeEnabled());
    await userEvent.click(first);
    await expect(screen.findByRole('button', { name: /begin practice/i })).resolves.toBeTruthy();
  });
});

describe.each(FLIPPED)('%s: the flipped pack still runs', (language) => {
  it('walks the stored pack through the v2 shell', async () => {
    const raw = readRaw(language);
    expect(raw.schemaVersion).toBe(2);
    await walkFirstLesson(normalizePack(raw));
  });
});
