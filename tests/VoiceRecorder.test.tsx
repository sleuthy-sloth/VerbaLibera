import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceRecorder } from '@/components/session/VoiceRecorder';

class FakeRecorder {
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = 'audio/webm';
  stream: unknown;
  constructor(stream: unknown) {
    this.stream = stream;
    (FakeRecorder as unknown as { instances: unknown[] }).instances.push(this);
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
  static instances: FakeRecorder[] = [];
}

describe('VoiceRecorder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeRecorder.instances = [];
  });

  it('records and plays back without uploading', async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
    });
    vi.stubGlobal('MediaRecorder', FakeRecorder as unknown as typeof MediaRecorder);
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { unmount } = render(<VoiceRecorder />);

    await user.click(screen.getByRole('button', { name: 'Record yourself' }));
    expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));

    expect(await screen.findByRole('button', { name: 'Record again' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your recording')).toHaveAttribute('src', 'blob:recording');
    expect(screen.getByText(/Nothing was uploaded/)).toBeInTheDocument();
    expect(createUrl).toHaveBeenCalledTimes(1);

    unmount();
    expect(revokeUrl).toHaveBeenCalledWith('blob:recording');
  });

  it('explains honestly when the microphone is blocked', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    vi.stubGlobal('MediaRecorder', FakeRecorder as unknown as typeof MediaRecorder);

    render(<VoiceRecorder />);
    await user.click(screen.getByRole('button', { name: 'Record yourself' }));

    expect(await screen.findByText(/Microphone is blocked/)).toBeInTheDocument();
  });

  it('explains honestly without recording support', () => {
    vi.stubGlobal('navigator', {});
    render(<VoiceRecorder />);
    expect(screen.getByText(/needs a browser with microphone recording/)).toBeInTheDocument();
  });
});
