import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { CourseWorkspace } from '@/features/course-pack/CourseWorkspace';
import type { CourseEnvironment } from '@/features/course-pack/environment';
import { validatePack } from '@/features/course-pack/schema';
import type { PracticeEvent } from '@/features/course-pack/progress';

const pack = validatePack(JSON.parse(readFileSync('courses/italian/manifest.json', 'utf8')));
function environment(events: PracticeEvent[] = [], install = async () => {}): CourseEnvironment {
  return {
    capabilities: { accounts: false, synchronization: false, offlineInstall: true, hostedNavigation: false },
    loadPack: async () => pack, resolveMedia: url => url, install, isInstalled: async () => false,
    practice: { getDurability: () => 'durable', subscribeDurability: () => () => {}, read: async () => events, write: async () => {} },
  };
}

describe('foundation entry', () => {
  it('opens Lesson 0 teaching immediately from Start learning', async () => {
    render(<CourseWorkspace environment={environment()} startNextLesson />);
    expect(await screen.findByRole('button', { name: 'Begin practice' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'First words' })).toBeVisible();
    expect(screen.getByText(/Your aim:/)).toBeVisible();
  });

  it('resumes after completed Lesson 0 without clearing history', async () => {
    const events = pack.lessons[0].exercises.filter(e => !pack.lessons[0].optionalExerciseIds.includes(e.id)).map((e, i) => ({
      id: `saved-${i}`, packId: pack.id, version: pack.version, exerciseId: e.id,
      at: '2026-09-06T12:00:00.000Z', correct: true, revealed: false,
    }));
    render(<CourseWorkspace environment={environment(events)} startNextLesson />);
    expect(await screen.findByRole('button', { name: 'Begin practice' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Names and introductions' })).toBeVisible();
    expect(screen.getByText(/1\/25 lessons practised/)).toBeVisible();
  });

  it('does not report offline readiness before the download commits', async () => {
    let finish!: () => void;
    const install = () => new Promise<void>(resolve => { finish = resolve; });
    const user = userEvent.setup();
    render(<CourseWorkspace environment={environment([], install)} />);
    const panel = await screen.findByRole('region', { name: /Download Italian/i });
    await user.click(within(panel).getByRole('button', { name: 'Download for offline study' }));
    expect(within(panel).getByRole('button', { name: /Downloading/ })).toBeDisabled();
    expect(within(panel).queryByRole('link', { name: 'Open offline study' })).toBeNull();
    await act(async () => finish());
    expect(within(panel).getByRole('link', { name: 'Open offline study' })).toHaveAttribute('href', '/study.html?language=italian');
  });

  it('keeps a failed download retryable without claiming it is ready', async () => {
    const user = userEvent.setup();
    render(<CourseWorkspace environment={environment([], async () => { throw new Error('Connection lost. Retry when connected.'); })} />);
    const panel = await screen.findByRole('region', { name: /Download Italian/i });
    await user.click(within(panel).getByRole('button', { name: 'Download for offline study' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Connection lost');
    expect(within(panel).getByRole('button', { name: 'Download for offline study' })).toBeEnabled();
    expect(within(panel).queryByRole('link', { name: 'Open offline study' })).toBeNull();
  });
});
