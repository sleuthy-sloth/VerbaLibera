import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CourseWorkspace } from '@/features/course-pack/CourseWorkspace';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import { createMemoryLessonPractice, type CourseEnvironment } from '@/features/course-pack/environment';
import { makePilotPack } from './fixtures/lesson-variety';

const pilotPack = () => normalizePack(makePilotPack());
const baseEnvironment = (over: Partial<CourseEnvironment>): CourseEnvironment => ({
  capabilities: { accounts: false, synchronization: false, offlineInstall: false, hostedNavigation: false },
  practice: { getDurability: () => 'temporary', subscribeDurability: () => () => {}, read: async () => [], write: async () => {} },
  lessonPractice: createMemoryLessonPractice(),
  loadPack: vi.fn(),
  loadCourse: async () => pilotPack(),
  resolveMedia: (u) => u,
  ...over,
});

it('opens a v2 story through the course boundary while keeping prerequisites locked', async () => {
  const environment = baseEnvironment({});
  render(<CourseWorkspace environment={environment} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Una storia al bar' })).toBeEnabled());
  expect(screen.getByRole('navigation', { name: 'Course path' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Al bar con il barista' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Una storia al bar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Begin practice' }));
  expect(await screen.findByRole('button', { name: 'Show translation' })).toBeVisible();
  expect(environment.loadPack).not.toHaveBeenCalled();
});

it('offers the shared offline download on the v2 course path and installs the runtime pack', async () => {
  const install = vi.fn().mockResolvedValue(undefined);
  let installed = false;
  const environment = baseEnvironment({
    capabilities: { accounts: false, synchronization: false, offlineInstall: true, hostedNavigation: false },
    install,
    isInstalled: vi.fn(async () => installed),
  });
  render(<CourseWorkspace environment={environment} />);
  const region = await screen.findByRole('region', { name: /Download Variet.*pilota/i });
  expect(await screen.findByText('Not downloaded yet')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Download for offline study' }));
  await waitFor(() => expect(install).toHaveBeenCalledTimes(1));
  const pack = install.mock.calls[0][0] as { id: string; version: string };
  expect(pack.id).toBe('it-variety-pilot');
  expect(pack.version).toBe(pilotPack().version);
  expect(install.mock.calls[0][1]).toBe('italian');
  installed = true;
  expect(await screen.findByText('Downloaded on this device')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Open offline study' })).toHaveAttribute('href', '/study.html?language=italian');
});

it('does not render the offline download when the edition lacks offlineInstall', async () => {
  const environment = baseEnvironment({});
  render(<CourseWorkspace environment={environment} />);
  await screen.findByRole('navigation', { name: 'Course path' });
  expect(screen.queryByRole('region', { name: /Download/i })).toBeNull();
});
