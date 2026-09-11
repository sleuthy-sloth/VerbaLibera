import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ListenPlayer, formatPosition } from '@/components/listen/ListenPlayer';
import {
  MIN_RESUME_SECONDS,
  clearPosition,
  positionKey,
  readPosition,
  savePosition,
} from '@/features/listen/position';
import type { ListenTrack } from '@/features/listen/tracks';

/**
 * Listen resume behaviour (roadmap 3A).
 *
 * An eleven-minute track that forgets where you stopped is one you never
 * finish, so the position is persisted browser-locally and offered back. These
 * cases pin the parts that would silently rot: the seek actually happens on
 * load, a stray tap is not treated as a resume point, a finished track is not
 * resumed into its last seconds, denied storage still works for the session,
 * and "start over" really clears the record.
 */

const track: ListenTrack = {
  lessonId: 'fr-identity-foundation',
  courseSlug: 'french',
  lessonTitle: 'Names and introductions',
  audioUrl: '/audio/french-foundations/fr-identity-listen.mp3',
  durationS: 660,
  sections: [{ heading: 'Start', teacher: 'Listen.', target: { text: 'Bonjour', meaning: 'Hello' } }],
};

const LONG = 660;

/** The audio element, with jsdom's read-only `duration` made settable. */
function player() {
  render(<ListenPlayer track={track} courseTitle="French foundations" />);
  const audio = document.querySelector('audio') as HTMLAudioElement;
  Object.defineProperty(audio, 'duration', { value: LONG, configurable: true });
  return audio;
}

/** jsdom never loads media, so the metadata event is dispatched by hand. */
function loadedMetadata(audio: HTMLAudioElement) {
  fireEvent(audio, new Event('loadedmetadata'));
}

afterEach(() => {
  localStorage.clear();
  clearPosition(track.lessonId);
});

describe('listen position', () => {
  it('formats a position as m:ss', () => {
    expect(formatPosition(183.4)).toBe('3:03');
    expect(formatPosition(0)).toBe('0:00');
    expect(formatPosition(59.9)).toBe('0:59');
  });

  it('does not treat a stray tap as a resume point', () => {
    expect(savePosition(track.lessonId, 2, LONG)).toBeNull();
    expect(readPosition(track.lessonId)).toBeNull();
    // The threshold is a named constant rather than a magic number in a test.
    expect(savePosition(track.lessonId, MIN_RESUME_SECONDS, LONG)).toBe(MIN_RESUME_SECONDS);
    expect(readPosition(track.lessonId)).toBe(MIN_RESUME_SECONDS);
  });

  it('clears rather than resuming into the last seconds of a finished track', () => {
    savePosition(track.lessonId, 300, LONG);
    expect(savePosition(track.lessonId, LONG - 4, LONG)).toBeNull();
    expect(readPosition(track.lessonId)).toBeNull();
  });

  it('ignores a stored value that is unusable', () => {
    localStorage.setItem(positionKey(track.lessonId), 'not-a-number');
    expect(readPosition(track.lessonId)).toBeNull();
    localStorage.setItem(positionKey(track.lessonId), '-12');
    expect(readPosition(track.lessonId)).toBeNull();
  });

  it('keeps working for the session when storage is denied', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(savePosition(track.lessonId, 240, LONG)).toBe(240);
    expect(readPosition(track.lessonId)).toBe(240);
    clearPosition(track.lessonId);
    expect(readPosition(track.lessonId)).toBeNull();
    setItem.mockRestore();
    getItem.mockRestore();
  });
});

describe('ListenPlayer resume', () => {
  it('picks up where the learner stopped and says so', async () => {
    savePosition(track.lessonId, 240, LONG);
    const audio = player();

    // Offered before playing, so the choice is the learner's.
    expect(await screen.findByText(/resume from 4:00/i)).toBeInTheDocument();
    loadedMetadata(audio);
    expect(audio.currentTime).toBe(240);
    expect(screen.getByText(/resumed at 4:00/i)).toBeInTheDocument();
  });

  it('starts at the beginning when nothing was saved', async () => {
    const audio = player();
    expect(screen.queryByText(/resume from/i)).toBeNull();
    loadedMetadata(audio);
    expect(audio.currentTime).toBe(0);
    expect(screen.queryByText(/resumed at/i)).toBeNull();
  });

  it('saves on pause and on seek', async () => {
    const audio = player();
    loadedMetadata(audio);
    audio.currentTime = 125;
    fireEvent(audio, new Event('pause'));
    expect(readPosition(track.lessonId)).toBe(125);

    audio.currentTime = 300;
    fireEvent(audio, new Event('seeked'));
    expect(readPosition(track.lessonId)).toBe(300);
  });

  it('throttles timeupdate instead of writing on every tick', async () => {
    const audio = player();
    loadedMetadata(audio);
    audio.currentTime = 121;
    fireEvent(audio, new Event('timeupdate'));
    expect(readPosition(track.lessonId)).toBe(121);
    // Under the threshold: the stored value stays where it was.
    audio.currentTime = 122;
    fireEvent(audio, new Event('timeupdate'));
    expect(readPosition(track.lessonId)).toBe(121);
    audio.currentTime = 127;
    fireEvent(audio, new Event('timeupdate'));
    expect(readPosition(track.lessonId)).toBe(127);
  });

  it('saves when the page is hidden, which is how long tracks usually end', async () => {
    const audio = player();
    loadedMetadata(audio);
    audio.currentTime = 411;
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(readPosition(track.lessonId)).toBe(411);
  });

  it('clears the position when the track finishes', async () => {
    savePosition(track.lessonId, 240, LONG);
    const audio = player();
    loadedMetadata(audio);
    fireEvent(audio, new Event('ended'));
    expect(readPosition(track.lessonId)).toBeNull();
    expect(await screen.findByText(/heard, not mastered/i)).toBeInTheDocument();
  });

  it('clears the position and rewinds on "start over"', async () => {
    const user = userEvent.setup();
    savePosition(track.lessonId, 240, LONG);
    const audio = player();
    await screen.findByText(/resume from 4:00/i);
    loadedMetadata(audio);
    expect(audio.currentTime).toBe(240);

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(audio.currentTime).toBe(0);
    expect(readPosition(track.lessonId)).toBeNull();
    expect(screen.queryByText(/resume from/i)).toBeNull();
  });

  it('drops a saved position that is past the end of the file', async () => {
    // A re-encoded track can be shorter than the moment the learner stopped at.
    // Writing the raw key is the only way to reach that state: `savePosition`
    // would already have treated 900s against a 660s track as finished.
    localStorage.setItem(positionKey(track.lessonId), '900');
    const audio = player();
    await screen.findByText(/resume from 15:00/i);
    loadedMetadata(audio);
    expect(audio.currentTime).toBe(0);
    expect(readPosition(track.lessonId)).toBeNull();
  });

  it('keeps the transcript available next to the resume note', async () => {
    savePosition(track.lessonId, 240, LONG);
    player();
    expect(await screen.findByText(/read along \(transcript\)/i)).toBeInTheDocument();
  });
});
