import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { CourseWorkspace } from '@/features/course-pack/CourseWorkspace';
import type { CourseEnvironment } from '@/features/course-pack/environment';
import { validatePack } from '@/features/course-pack/schema';
import type { PracticeEvent } from '@/features/course-pack/progress';

const pack = validatePack(JSON.parse(readFileSync('courses/german/manifest.json', 'utf8')));
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
    expect(screen.getByRole('heading', { name: 'Introducing yourself' })).toBeVisible();
    // `?start=1` opens the lesson in the lesson shell, so the way out is the
    // only navigation on the page. It used to scroll into a 3,000px course page
    // and leave the learner below the chrome with no sticky context.
    expect(screen.getByRole('button', { name: /Back to the course/ })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Course path' })).toBeNull();
  });

  it('states progress and storage scope in one line, not two sentences', async () => {
    const events = pack.lessons[0].exercises.filter(e => !pack.lessons[0].optionalExerciseIds.includes(e.id)).map((e, i) => ({
      id: `saved-${i}`, packId: pack.id, version: pack.version, exerciseId: e.id,
      at: '2026-09-06T12:00:00.000Z', correct: true, revealed: false,
    }));
    render(<CourseWorkspace environment={environment(events)} initialLanguage="german" />);
    // Was: "N practice results on this device · N/25 lessons practised
    // successfully. Device practice is separate from account progress." — two
    // sentences about which layer holds your progress, above the course path.
    const line = await screen.findByText((_, element) =>
      element?.tagName === 'P' && /1 of 8 lessons practised/.test(element.textContent ?? ''),
    );
    expect(line).toHaveTextContent('kept in this browser');
    expect(screen.queryByRole('navigation', { name: 'Course path' })).toBeInTheDocument();
  });

  it('does not report offline readiness before the download commits', async () => {
    let finish!: () => void;
    const install = () => new Promise<void>(resolve => { finish = resolve; });
    const user = userEvent.setup();
    render(<CourseWorkspace environment={environment([], install)} initialLanguage="german" />);
    const panel = await screen.findByRole('region', { name: /Download German/i });
    await user.click(within(panel).getByRole('button', { name: 'Download for offline study' }));
    expect(within(panel).getByRole('button', { name: /Downloading/ })).toBeDisabled();
    expect(within(panel).queryByRole('link', { name: 'Open offline study' })).toBeNull();
    await act(async () => finish());
    expect(within(panel).getByRole('link', { name: 'Open offline study' })).toHaveAttribute('href', '/study.html?language=german');
  });

  it('keeps a failed download retryable without claiming it is ready', async () => {
    const user = userEvent.setup();
    render(<CourseWorkspace environment={environment([], async () => { throw new Error('Connection lost. Retry when connected.'); })} />);
    const panel = await screen.findByRole('region', { name: /Download German/i });
    await user.click(within(panel).getByRole('button', { name: 'Download for offline study' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Connection lost');
    expect(within(panel).getByRole('button', { name: 'Download for offline study' })).toBeEnabled();
    expect(within(panel).queryByRole('link', { name: 'Open offline study' })).toBeNull();
  });
});
