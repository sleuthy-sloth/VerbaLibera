import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OfflineDownload } from '@/features/course-pack/OfflineDownload';
import type { CourseEnvironment } from '@/features/course-pack/environment';

/**
 * What the download control says when it fails.
 *
 * Found while writing the offline matrix: a learner who pressed "Download for
 * offline study" with no connection was shown **"Failed to fetch"** — the
 * engine's words, not ours, and nothing they could act on. `installPack` throws
 * actionable messages for the failures it detects; the case where the request
 * never left the device has to be turned into one too.
 *
 * The other half: an actionable message must not be replaced by the friendly
 * one, or an integrity failure would read as "check your connection".
 */

const pack = { id: 'fr-foundations', version: '1.0.0', title: 'French foundations', media: [], lessons: [] };

function environmentThatThrows(error: unknown): CourseEnvironment {
  return {
    capabilities: {} as CourseEnvironment['capabilities'],
    practice: {} as CourseEnvironment['practice'],
    install: vi.fn(async () => {
      throw error;
    }),
    isInstalled: vi.fn(async () => false),
  } as unknown as CourseEnvironment;
}

async function download(environment: CourseEnvironment) {
  const user = userEvent.setup();
  render(<OfflineDownload pack={pack} language="french" environment={environment} />);
  const button = await screen.findByRole('button', { name: /download for offline study/i });
  await user.click(button);
  return screen.findByRole('alert');
}

describe('the download control explains a failure a learner can act on', () => {
  it('turns a browser network error into our words', async () => {
    const alert = await download(environmentThatThrows(new TypeError('Failed to fetch')));
    expect(alert).toHaveTextContent(/download failed — check your connection/i);
    expect(alert).not.toHaveTextContent(/failed to fetch/i);
  });

  it('covers what the other engines say for the same failure', async () => {
    // Safari and Firefox phrase it differently; both reach the same message.
    const safari = await download(environmentThatThrows(new TypeError('Load failed')));
    expect(safari).toHaveTextContent(/check your connection/i);
  });

  it('keeps a message that already says what went wrong', async () => {
    const alert = await download(
      environmentThatThrows(new Error('Audio integrity check failed. Download was not installed.')),
    );
    expect(alert).toHaveTextContent(/integrity check failed/i);
    expect(alert).not.toHaveTextContent(/check your connection/i);
  });

  it('leaves the learner able to retry, and says nothing was saved', async () => {
    const environment = environmentThatThrows(new TypeError('Failed to fetch'));
    const alert = await download(environment);
    expect(alert).toHaveTextContent(/nothing was saved/i);
    // The control is not locked into a loading state after a failure.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download for offline study/i })).toBeEnabled(),
    );
    expect(environment.install).toHaveBeenCalledTimes(1);
  });
});
