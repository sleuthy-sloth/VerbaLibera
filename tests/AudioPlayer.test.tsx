import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AudioPlayer,
  type AudioPlayerHandle,
  type AudioSegment,
} from '@/components/audio/AudioPlayer';

const prompt: AudioSegment = {
  id: 'prompt-1',
  url: 'https://example.test/prompt.mp3',
  type: 'prompt',
  pauseAfter: true,
  transcript: 'How would you say hello?',
};

const answer: AudioSegment = {
  id: 'answer-1',
  url: 'https://example.test/answer.mp3',
  type: 'answer',
  pauseAfter: false,
  transcript: 'Bonjour.',
};

function setupAudio(play: () => Promise<void> = () => Promise.resolve()) {
  const audio = document.createElement('audio');
  const AudioConstructor = function AudioMock() {
    return audio;
  };
  vi.spyOn(audio, 'play').mockImplementation(play);
  vi.spyOn(audio, 'pause').mockImplementation(() => undefined);

  vi.stubGlobal('Audio', AudioConstructor);

  return { audio };
}

describe('AudioPlayer', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  it('starts playback only after the learner presses Start lesson', async () => {
    // Break caught: entering a playing state without an explicit learner action.
    setupAudio();
    const user = userEvent.setup();

    render(<AudioPlayer segments={[prompt]} />);

    expect(screen.getByRole('status')).toHaveTextContent(/ready to start/i);
    expect(screen.getByRole('button', { name: /start lesson/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/playing segment 1 of 1/i));
    expect(screen.queryByRole('button', { name: /start lesson/i })).not.toBeInTheDocument();
  });

  it('holds indefinitely after a pausing prompt until the learner elects to play the answer', async () => {
    // Break caught: a timer automatically resumes a required thinking pause.
    vi.useFakeTimers();
    const { audio } = setupAudio();
    const onThinkComplete = vi.fn();

    render(
      <AudioPlayer
        segments={[prompt, answer]}
        onThinkComplete={onThinkComplete}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start lesson/i }));
      await Promise.resolve();
    });
    act(() => fireEvent.ended(audio));
    expect(screen.getByText(/think it through/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play answer/i })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(onThinkComplete).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/think it through/i);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /play answer/i }));
      await Promise.resolve();
    });
    expect(onThinkComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/playing segment 2 of 2/i);
    expect(screen.getByText('Bonjour.')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('automatically advances across non-pausing segments and completes at the end', async () => {
    // Break caught: treating every segment end as a thinking pause.
    const first: AudioSegment = { ...prompt, pauseAfter: false };
    const { audio } = setupAudio();
    const onComplete = vi.fn();
    const user = userEvent.setup();

    render(<AudioPlayer segments={[first, answer]} onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    fireEvent.ended(audio);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/playing segment 2 of 2/i));
    expect(screen.getByText('Bonjour.')).toBeInTheDocument();
    expect(screen.queryByText(/think it through/i)).not.toBeInTheDocument();

    fireEvent.ended(audio);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/lesson complete/i)).toBeInTheDocument();
  });

  it('requires an explicit finish action for a final pausing segment', async () => {
    // Break caught: dropping a final pause because no answer segment follows it.
    const { audio } = setupAudio();
    const onThinkComplete = vi.fn();
    const onComplete = vi.fn();
    const user = userEvent.setup();

    render(
      <AudioPlayer
        segments={[prompt]}
        onThinkComplete={onThinkComplete}
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    fireEvent.ended(audio);
    expect(screen.getByRole('button', { name: /finish lesson/i })).toBeInTheDocument();

    const finishLesson = screen.getByRole('button', { name: /finish lesson/i });
    act(() => {
      fireEvent.click(finishLesson);
      fireEvent.click(finishLesson);
    });
    expect(onThinkComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/lesson complete/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no segments', () => {
    // Break caught: rendering a Start control that cannot play anything.
    setupAudio();

    render(<AudioPlayer segments={[]} />);

    expect(screen.getByText(/no audio segments available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start lesson/i })).not.toBeInTheDocument();
  });

  it('shows fixture audio as unavailable instead of offering it as playable', () => {
    // Break caught: calling play() for an unavailable fixture URL.
    setupAudio();
    const onError = vi.fn();

    render(
      <AudioPlayer
        segments={[{ ...prompt, url: 'unavailable://fixture/prompt-1' }]}
        onError={onError}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/audio unavailable/i);
    expect(screen.queryByRole('button', { name: /start lesson/i })).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected media start and lets the learner retry', async () => {
    // Break caught: swallowing a rejected play() promise without a recovery path.
    const playbackFailure = new Error('Playback blocked');
    let startAttempts = 0;
    setupAudio(() => {
      startAttempts += 1;
      return startAttempts === 1 ? Promise.reject(playbackFailure) : Promise.resolve();
    });
    const onError = vi.fn();
    const user = userEvent.setup();

    render(<AudioPlayer segments={[prompt]} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/playback blocked/i);
    expect(onError).toHaveBeenCalledWith(playbackFailure);

    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/playing segment 1 of 1/i));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports an error emitted after media has started and lets the learner retry', async () => {
    // Break caught: omitting the media error event listener after play() resolves.
    const { audio } = setupAudio();
    const onError = vi.fn();
    const user = userEvent.setup();

    render(<AudioPlayer segments={[prompt]} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/playing segment 1 of 1/i));
    fireEvent.error(audio);

    expect(await screen.findByRole('alert')).toHaveTextContent(/audio playback failed/i);
    expect(screen.getByRole('button', { name: /retry audio/i })).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/playing segment 1 of 1/i));
  });

  it('makes repeated visible Play answer activations idempotent', async () => {
    // Break caught: completing one thinking pause more than once from its visible action.
    const { audio } = setupAudio();
    const onThinkComplete = vi.fn();
    const user = userEvent.setup();

    render(
      <AudioPlayer
        segments={[prompt, answer]}
        onThinkComplete={onThinkComplete}
      />,
    );

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    fireEvent.ended(audio);
    const playAnswer = screen.getByRole('button', { name: /play answer/i });
    act(() => {
      fireEvent.click(playAnswer);
      fireEvent.click(playAnswer);
    });

    await waitFor(() => expect(onThinkComplete).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent(/playing segment 2 of 2/i);
  });

  it('restarts the current lesson through its imperative handle', async () => {
    // Break caught: restart retaining an old session or active media source.
    const { audio } = setupAudio();
    const ref = createRef<AudioPlayerHandle>();
    const user = userEvent.setup();

    render(<AudioPlayer ref={ref} segments={[prompt]} />);

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    act(() => ref.current?.restart());
    fireEvent.ended(audio);

    expect(screen.getByRole('status')).toHaveTextContent(/ready to start/i);
    expect(screen.getByRole('button', { name: /start lesson/i })).toBeInTheDocument();
  });

  it('continues thinking with an unmodified, non-repeated Spacebar press', async () => {
    // Break caught: omitting the keyboard continuation path for a thinking pause.
    const { audio } = setupAudio();
    const onThinkComplete = vi.fn();
    const user = userEvent.setup();

    render(<AudioPlayer segments={[prompt, answer]} onThinkComplete={onThinkComplete} />);

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    fireEvent.ended(audio);
    const keydown = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    expect(window.dispatchEvent(keydown)).toBe(false);
    await waitFor(() => expect(onThinkComplete).toHaveBeenCalledTimes(1));
  });

  it('does not hijack Spacebar presses in editable controls or with modifiers', async () => {
    // Break caught: preventing normal typing or browser shortcuts while thinking.
    const { audio } = setupAudio();
    const onThinkComplete = vi.fn();
    const user = userEvent.setup();

    render(<AudioPlayer segments={[prompt, answer]} onThinkComplete={onThinkComplete} />);
    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    fireEvent.ended(audio);

    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    document.body.append(input);
    document.body.append(textarea);
    document.body.append(editable);
    const inputSpace = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    const textareaSpace = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    const editableSpace = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    expect(input.dispatchEvent(inputSpace)).toBe(true);
    expect(textarea.dispatchEvent(textareaSpace)).toBe(true);
    expect(editable.dispatchEvent(editableSpace)).toBe(true);
    expect(window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, cancelable: true }))).toBe(true);
    expect(window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', metaKey: true, cancelable: true }))).toBe(true);
    expect(window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', altKey: true, cancelable: true }))).toBe(true);
    expect(window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true, cancelable: true }))).toBe(true);
    expect(onThinkComplete).not.toHaveBeenCalled();
    input.remove();
    textarea.remove();
    editable.remove();
  });

  it('resets safely when replacement segments arrive and ignores stale media events', async () => {
    // Break caught: stale media completion or failure changing the replacement lesson.
    const { audio } = setupAudio();
    const onComplete = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<AudioPlayer segments={[prompt]} onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    rerender(<AudioPlayer segments={[answer]} onComplete={onComplete} />);
    fireEvent.ended(audio);
    fireEvent.error(audio);

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start lesson/i })).toBeInTheDocument();
  });

  it('removes media resources and listeners when unmounted', async () => {
    // Break caught: retaining playback resources or media listeners after unmount.
    const { audio } = setupAudio();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <AudioPlayer segments={[prompt]} onComplete={onComplete} onError={onError} />,
    );

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    unmount();
    fireEvent.ended(audio);
    fireEvent.error(audio);

    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('exposes 44px controls, named buttons, and polite status updates', () => {
    // Break caught: controls becoming too small or inaccessible to assistive technology.
    setupAudio();

    render(<AudioPlayer segments={[prompt]} />);

    expect(screen.getByRole('button', { name: /start lesson/i })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
