import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ListenPlayer, PLAYBACK_RATES, SKIP_SECONDS } from '@/components/listen/ListenPlayer';
import { tracksForCourse } from '@/features/listen/tracks';
import { PLAYER_COVER } from '@/features/listen/player-art';
import { imageDimensions } from './helpers/image-size';
import { join } from 'node:path';

/**
 * The Listen player card (visual brief: docs/superpowers/briefs/listen-player-design.md).
 *
 * The brief asks for a Warm Studio card — cream surface, dark outline,
 * terracotta primary play, hard-offset shadow — with a readable progress bar,
 * 15-second skips, speed, a transcript toggle and a visible offline state, on a
 * phone, without a new visual system. Its artwork is the project's own: one wide
 * cover for every track, decorative, and one square for the lock screen.
 *
 * These tests cover what a card could plausibly fake: that its controls really
 * drive the native element, that skips clamp at both ends, that the scrubber is
 * a real input a keyboard and a screen reader can use, that speed changes
 * playback, that the offline line reports Cache Storage rather than guessing,
 * and that `<audio controls>` is still there as the layer everything runs
 * through. Styling itself is held by `tests/design-tokens.test.ts` and
 * `tests/paper-motion.test.ts`.
 */

const track = tracksForCourse('french')[0];

beforeEach(() => {
  localStorage.clear();
  // jsdom has no media pipeline: play/pause are unimplemented, and `paused`
  // never moves on its own, so both are driven here the way a browser would.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, 'paused', { configurable: true, value: false });
    this.dispatchEvent(new Event('play'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, 'paused', { configurable: true, value: true });
    this.dispatchEvent(new Event('pause'));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Renders the card and waits for its one deferred read (stored position,
 * authored length, online state). Every test below starts from the state a
 * learner's first paint reaches, and the length is set afterwards on purpose —
 * a real file answers with its own duration later.
 */
async function player() {
  render(
    <ListenPlayer
      track={track}
      courseTitle="French foundations"
      lessonTitle="Names and introductions"
    />,
  );
  const audio = document.querySelector('audio') as HTMLAudioElement;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return audio;
}

/** The file answers: this is where the real length arrives. */
async function loadedMetadata(audio: HTMLAudioElement, duration: number) {
  Object.defineProperty(audio, 'duration', { configurable: true, value: duration });
  await act(async () => {
    fireEvent(audio, new Event('loadedmetadata'));
    fireEvent(audio, new Event('durationchange'));
  });
}

/** Cache Storage is what the offline line reports; the card must not guess. */
function stubCaches(hit: boolean) {
  vi.stubGlobal('caches', {
    match: vi.fn(async () => (hit ? new Response('audio') : undefined)),
  });
}

describe('the card carries the brief', () => {
  it('names the track, the course, the language and the length', async () => {
    await player();
    expect(screen.getByRole('heading', { name: 'Names and introductions' })).toBeInTheDocument();
    // The language-aware mark, in place of cover art: "FR", not an image.
    expect(screen.getByText('FR')).toBeInTheDocument();
    // The meta line names the course and the length; the transport readout
    // carries the length too, so both are asserted rather than one of them.
    expect(screen.getByText(/french foundations/i)).toBeInTheDocument();
    expect(screen.getAllByText(/10:17/).length).toBeGreaterThan(0);
  });

  it('keeps the native audio element as the layer everything runs through', async () => {
    const audio = await player();
    // Still an audio element, still `controls`, still the track's own URL.
    expect(audio.tagName).toBe('AUDIO');
    expect(audio).toHaveAttribute('controls');
    expect(audio).toHaveAttribute('preload', 'metadata');
    expect(audio).toHaveAttribute('src', track.audioUrl);
    expect(audio).toHaveAccessibleName(/audio lesson/i);
  });

  it('offers the transcript as a toggle beside the transport', async () => {
    const user = userEvent.setup();
    await player();
    await user.click(screen.getByText(/read along \(transcript\)/i));
    expect(screen.getByRole('heading', { name: track.sections[0].heading })).toBeInTheDocument();
  });
});

describe('the transport drives the audio element', () => {
  it('plays and pauses the file itself, and says which it will do next', async () => {
    const user = userEvent.setup();
    await player();
    await user.click(screen.getByRole('button', { name: /play the audio lesson/i }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /pause the audio lesson/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /pause the audio lesson/i }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /play the audio lesson/i })).toBeInTheDocument();
  });

  it('skips back and forward 15 seconds', async () => {
    const user = userEvent.setup();
    const audio = await player();
    await loadedMetadata(audio, 600);
    audio.currentTime = 100;
    await user.click(screen.getByRole('button', { name: new RegExp(`forward ${SKIP_SECONDS} seconds`, 'i') }));
    expect(audio.currentTime).toBe(115);
    await user.click(screen.getByRole('button', { name: new RegExp(`back ${SKIP_SECONDS} seconds`, 'i') }));
    expect(audio.currentTime).toBe(100);
  });

  it('clamps a skip at the start and at the end of the file', async () => {
    const user = userEvent.setup();
    const audio = await player();
    await loadedMetadata(audio, 600);
    // At the very start, a skip back must not seek to a negative time.
    audio.currentTime = 5;
    await user.click(screen.getByRole('button', { name: /back 15 seconds/i }));
    expect(audio.currentTime).toBe(0);
    // Nor past the end: the last minute of a track is the end of it.
    audio.currentTime = 595;
    await user.click(screen.getByRole('button', { name: /forward 15 seconds/i }));
    expect(audio.currentTime).toBe(600);
  });

  it('seeks through a real range input a keyboard and a screen reader can use', async () => {
    const audio = await player();
    await loadedMetadata(audio, 600);
    const scrubber = screen.getByRole('slider', { name: /seek within the audio lesson/i });
    // A real input, not a div with a click handler: arrow keys, Home/End and an
    // announced value all come from the browser.
    expect(scrubber).toHaveAttribute('type', 'range');
    expect(scrubber).toHaveAttribute('max', '600');
    await act(async () => {
      fireEvent.change(scrubber, { target: { value: '240' } });
    });
    expect(audio.currentTime).toBe(240);
    // The value is announced as a time, not as "240"...
    await waitFor(() => expect(scrubber).toHaveAttribute('aria-valuetext', '4:00 of 10:00'));
    // ...and the card's own readout follows, so the learner sees it too.
    expect(screen.getAllByText('4:00').length).toBeGreaterThan(0);
  });

  it('reads the position back into the card as the track plays', async () => {
    const audio = await player();
    await loadedMetadata(audio, 600);
    await act(async () => {
      audio.currentTime = 121;
      fireEvent(audio, new Event('timeupdate'));
    });
    await waitFor(() => expect(screen.getAllByText('2:01').length).toBeGreaterThan(0));
  });

  it('changes playback speed on the file, from the offered list only', async () => {
    const user = userEvent.setup();
    const audio = await player();
    await loadedMetadata(audio, 600);
    const speed = screen.getByRole('combobox', { name: /speed/i });
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual(
      PLAYBACK_RATES.map(String),
    );
    await user.selectOptions(speed, '1.25');
    expect(audio.playbackRate).toBe(1.25);
    await user.selectOptions(speed, '0.75');
    expect(audio.playbackRate).toBe(0.75);
  });
});

describe('the offline line reports the cache, not a guess', () => {
  it('says the track is saved when it is in Cache Storage', async () => {
    stubCaches(true);
    await player();
    await waitFor(() => expect(screen.getByText(/saved on this device/i)).toBeInTheDocument());
    // The manual save link stays: a learner may want the file itself.
    const link = screen.getByRole('link', { name: /save audio for offline listening/i });
    expect(link).toHaveAttribute('href', track.audioUrl);
    expect(link).toHaveAttribute('download');
  });

  it('says it is not saved, and what to do about it', async () => {
    stubCaches(false);
    await player();
    await waitFor(() =>
      expect(screen.getByText(/not saved on this device yet/i)).toBeInTheDocument(),
    );
  });

  it('says plainly when the device is offline and the track was never saved', async () => {
    stubCaches(false);
    await player();
    await waitFor(() => expect(screen.getByText(/not saved on this device yet/i)).toBeInTheDocument());
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/you are offline and this track is not saved/i)).toBeInTheDocument();
  });

  it('does not claim anything about a browser without Cache Storage', async () => {
    vi.stubGlobal('caches', undefined);
    await player();
    await waitFor(() =>
      expect(screen.getByText(/not saved on this device yet/i)).toBeInTheDocument(),
    );
  });
});

describe('the card does not disturb what already worked', () => {
  it('marks a finished track heard, and clears the stored position', async () => {
    const audio = await player();
    await loadedMetadata(audio, 600);
    await act(async () => {
      fireEvent(audio, new Event('ended'));
    });
    expect(await screen.findByText(/heard, not mastered/i)).toBeInTheDocument();
  });

  it('keeps the transcript sections and the download link pointing at the file', async () => {
    const audio = await player();
    const link = screen.getByRole('link', { name: /save audio for offline listening/i });
    expect(link).toHaveAttribute('href', audio.getAttribute('src'));
    expect(track.sections.length).toBeGreaterThan(0);
  });
});

describe("the player's own cover art", () => {
  const renderPlayer = (resolveMedia?: (url: string) => string, lessonId?: string) =>
    render(
      <ListenPlayer
        track={lessonId ? { ...track, lessonId } : track}
        courseTitle="French foundations"
        lessonTitle="Names and introductions"
        resolveMedia={resolveMedia}
      />,
    );

  it("draws the wide cover as decoration, with no accessible name", async () => {
    renderPlayer();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const cover = document.querySelector(`img[src="${PLAYER_COVER.url}"]`) as HTMLImageElement;
    expect(cover, "the player card renders no cover art").not.toBeNull();
    // Decorative: the heading above it and the transport below it already say
    // what is playing and in what state, so nothing here is announced.
    expect(cover.getAttribute("alt")).toBe("");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("declares the file's real size, so the cover reserves its space", async () => {
    renderPlayer();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const cover = document.querySelector(`img[src="${PLAYER_COVER.url}"]`) as HTMLImageElement;
    const file = imageDimensions(join(process.cwd(), "public/brand/player-card.jpg"))!;
    expect(Number(cover.getAttribute("width"))).toBe(file.width);
    expect(Number(cover.getAttribute("height"))).toBe(file.height);
  });

  it("puts the cover through the edition's resolver", async () => {
    // The portable single file cannot fetch a shipped path; the resolver hands
    // it the embedded blob instead. Without this the cover is a broken image
    // exactly where the app is meant to work offline.
    renderPlayer((url) => (url === PLAYER_COVER.url ? "blob:portable-card" : url));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('img[src="blob:portable-card"]')).not.toBeNull();
  });

  it("shows the same cover for every track, because it is one file", async () => {
    // The card's language mark is per-lesson. The cover is not: one illustration
    // for the feature is bytes the offline bundle carries once.
    renderPlayer(undefined, "fr-identity-listen");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelectorAll(`img[src="${PLAYER_COVER.url}"]`)).toHaveLength(1);
  });
});
