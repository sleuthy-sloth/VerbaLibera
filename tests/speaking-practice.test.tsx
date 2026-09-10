import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ActivityView } from '@/features/course-pack/activities/ActivityView';

/**
 * The lesson flow's only speaking step. It used to tell the learner to "say your
 * answer, then compare it with the model" while offering no way to hear
 * themselves, so these tests pin the recording, the ordering (record BEFORE the
 * model is revealed) and, most importantly, that a learner with no microphone
 * still gets the whole self-assessment.
 */

const spec = {
  kind: 'self-compare' as const,
  id: 'compare',
  revision: 1,
  conceptIds: [],
  vocabulary: [],
  skills: ['speaking' as const],
  prompt: 'Say hello',
  modelText: 'Buongiorno',
};

class FakeRecorder {
  static last: FakeRecorder | null = null;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = 'audio/webm';
  constructor(_stream: unknown) {
    FakeRecorder.last = this;
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['clip'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function giveMicrophone() {
  const tracks = [{ stop: vi.fn() }];
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }) },
  });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  return tracks;
}

function takeMicrophone() {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  vi.stubGlobal('MediaRecorder', undefined);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderStep(onChange = vi.fn(), onAssist = vi.fn()) {
  render(
    <ActivityView activity={spec} response={null} disabled={false} onChange={onChange} onAssist={onAssist} />,
  );
  return { onChange, onAssist };
}

it('lets the learner hear themselves before they see the model', async () => {
  const tracks = giveMicrophone();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:take-one');
  const { onChange } = renderStep();

  // Recording comes first: the model must not be on screen yet.
  expect(screen.queryByText('Buongiorno')).toBeNull();
  await userEvent.click(await screen.findByRole('button', { name: 'Record yourself saying it' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));

  const take = await screen.findByLabelText('Your recording');
  expect(take).toHaveAttribute('src', 'blob:take-one');
  expect(screen.queryByText('Buongiorno')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Reveal comparison model' }));
  expect(screen.getByText('Buongiorno')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Comfortable' }));
  expect(onChange).toHaveBeenCalledWith({ kind: 'self', rating: 'comfortable' });

  // The microphone is released rather than left live for the rest of the lesson.
  expect(tracks[0].stop).toHaveBeenCalled();
});

it('records again without leaking the previous take', async () => {
  giveMicrophone();
  const created: string[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const url = `blob:take-${created.length + 1}`;
    created.push(url);
    return url;
  });
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  renderStep();

  await userEvent.click(await screen.findByRole('button', { name: 'Record yourself saying it' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
  await screen.findByLabelText('Your recording');

  await userEvent.click(screen.getByRole('button', { name: 'Record again' }));
  expect(screen.getByRole('button', { name: 'Record yourself saying it' })).toBeVisible();
  expect(revoke).toHaveBeenCalledWith('blob:take-1');
});

it('uploads nothing: no network call and nothing written to storage', async () => {
  giveMicrophone();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private');
  const fetchSpy = vi.fn(() => {
    throw new Error('the speaking step must never upload a recording');
  });
  vi.stubGlobal('fetch', fetchSpy);
  const setItem = vi.spyOn(Storage.prototype, 'setItem');

  renderStep();
  await userEvent.click(await screen.findByRole('button', { name: 'Record yourself saying it' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
  await screen.findByLabelText('Your recording');
  await userEvent.click(screen.getByRole('button', { name: 'Reveal comparison model' }));
  await userEvent.click(screen.getByRole('button', { name: 'Comfortable' }));

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});

it('still self-assesses when the browser cannot record', async () => {
  takeMicrophone();
  const { onChange, onAssist } = renderStep();

  // No recorder, but the step the learner came for is intact.
  await userEvent.click(screen.getByRole('button', { name: 'Reveal comparison model' }));
  expect(screen.getByText('Buongiorno')).toBeVisible();
  expect(onAssist).toHaveBeenCalledWith('model');
  await userEvent.click(screen.getByRole('button', { name: 'Practise again' }));
  expect(onChange).toHaveBeenCalledWith({ kind: 'self', rating: 'again' });
  expect(screen.queryByRole('button', { name: 'Record yourself saying it' })).toBeNull();
});

it('says so plainly when the microphone is refused, and carries on', async () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
  });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  const { onChange } = renderStep();

  await userEvent.click(await screen.findByRole('button', { name: 'Record yourself saying it' }));

  expect(await screen.findByRole('note')).toHaveTextContent('Microphone is blocked');
  await userEvent.click(screen.getByRole('button', { name: 'Reveal comparison model' }));
  await userEvent.click(screen.getByRole('button', { name: 'Comfortable' }));
  expect(onChange).toHaveBeenCalledWith({ kind: 'self', rating: 'comfortable' });
});
