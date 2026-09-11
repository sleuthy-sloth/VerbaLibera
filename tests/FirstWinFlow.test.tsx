import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FirstWinFlow } from '@/components/onboarding/FirstWinFlow';
import { firstWinFor } from '@/features/onboarding/first-win';

const french = firstWinFor('english-to-french')!;
const italian = firstWinFor('english-to-italian')!;

const audioElement = (): HTMLAudioElement => {
  const element = document.querySelector('[data-first-win-audio]');
  if (!(element instanceof HTMLAudioElement)) throw new Error('no audio element');
  return element;
};

/** Walks to the recap, taking the correct answer at every step. */
async function toRecap(firstWin = french) {
  const user = userEvent.setup();
  render(<FirstWinFlow firstWin={firstWin} onFinish={() => {}} />);
  // meet
  await user.click(screen.getByRole('button', { name: /^continue$/i }));
  // recognize
  const recognize = firstWin.steps.find((step) => step.phase === 'recognize')!;
  await user.click(screen.getByRole('radio', { name: recognize.answer }));
  await user.click(screen.getByRole('button', { name: /^check$/i }));
  await user.click(screen.getByRole('button', { name: /^continue$/i }));
  // construct
  const construct = firstWin.steps.find((step) => step.phase === 'construct')!;
  for (const token of construct.answer.split(' '))
    await user.click(screen.getByRole('button', { name: token }));
  await user.click(screen.getByRole('button', { name: /^check$/i }));
  await user.click(screen.getByRole('button', { name: /^continue$/i }));
  // say — skipped, which must be as good as doing it
  await user.click(screen.getByRole('button', { name: /skip this step/i }));
  return user;
}

describe('FirstWinFlow', () => {
  it('says how short it is, and starts on the phrase', () => {
    render(<FirstWinFlow firstWin={french} onFinish={() => {}} />);
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /start with the sound of it/i })).toBeInTheDocument();
    expect(screen.getByText('Bonjour')).toBeInTheDocument();
    // Target-language text is tagged so a screen reader switches voice.
    expect(screen.getByText('Bonjour').closest('[lang]')).toHaveAttribute('lang', 'fr');
  });

  it('does not autoplay, and offers the words as text instead', () => {
    render(<FirstWinFlow firstWin={french} onFinish={() => {}} />);
    const audio = audioElement();
    expect(audio.autoplay).toBe(false);
    expect(audio.getAttribute('preload')).toBe('none');
    // The transcript is on the page from the start — text-first, not audio-first.
    expect(screen.getByText('Show the words')).toBeInTheDocument();
    expect(screen.getByText('Bonjour, merci.')).toBeInTheDocument();
  });

  it('carries on when the recording cannot load', async () => {
    const user = userEvent.setup();
    render(<FirstWinFlow firstWin={french} onFinish={() => {}} />);
    fireEvent.error(audioElement());
    expect(await screen.findByText(/the sound did not load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play the recording/i })).toBeDisabled();
    // The step is still completable, and the sequence still ends properly.
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByText(/what does it mean/i)).toBeInTheDocument();
  });

  it('marks a wrong choice, explains it, and does not move on', async () => {
    const user = userEvent.setup();
    render(<FirstWinFlow firstWin={french} onFinish={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.click(screen.getByRole('radio', { name: 'Thank you.' }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/not that one/i);
    // Still the same step: a wrong answer never advances, and never traps.
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Hello.' }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/holds all day/i);
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
  });

  it('rejects a build that leaves the wrong word out', async () => {
    const user = userEvent.setup();
    render(<FirstWinFlow firstWin={french} onFinish={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.click(screen.getByRole('radio', { name: 'Hello.' }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.click(screen.getByRole('button', { name: 'au revoir.' }));
    await user.click(screen.getByRole('button', { name: 'Bonjour,' }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/the greeting comes first/i);
    // Removing a word puts it back in the bank — the same word twice is impossible.
    await user.click(screen.getByRole('button', { name: 'Remove au revoir.' }));
    await user.click(screen.getByRole('button', { name: 'Remove Bonjour,' }));
    for (const token of ['Bonjour,', 'merci.'])
      await user.click(screen.getByRole('button', { name: token }));
    expect(screen.queryByRole('button', { name: 'au revoir.' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/word for word/i);
  });

  it('treats saying it out loud as optional and skippable', async () => {
    const user = userEvent.setup();
    render(<FirstWinFlow firstWin={french} onFinish={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.click(screen.getByRole('radio', { name: 'Hello.' }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    for (const token of ['Bonjour,', 'merci.'])
      await user.click(screen.getByRole('button', { name: token }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    // Claiming it shows an acknowledgement; skipping moves straight on. Both
    // reach the recap, and neither asks for a microphone.
    await user.click(screen.getByRole('button', { name: /i said it out loud/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/in your own voice/i);
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
  });

  it('ends on a recap that is concrete and admits it is not the lesson', async () => {
    await toRecap();
    expect(screen.getByRole('heading', { name: /you just spoke french/i })).toBeInTheDocument();
    expect(screen.getByText(/picked out the greeting/i)).toBeInTheDocument();
    expect(screen.getByText('Bonjour')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText(/nothing here counts as finished/i)).toBeInTheDocument();
  });

  it('offers three clear next actions from the recap', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    const firstWin = french;
    render(<FirstWinFlow firstWin={firstWin} onFinish={onFinish} />);
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.click(screen.getByRole('radio', { name: 'Hello.' }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    for (const token of ['Bonjour,', 'merci.'])
      await user.click(screen.getByRole('button', { name: token }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.click(screen.getByRole('button', { name: /skip this step/i }));

    // Next lesson, look around, or repeat — and nothing is decided before the
    // learner presses one of them.
    expect(onFinish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /run through it again/i }));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.click(screen.getByRole('radio', { name: 'Hello.' }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    for (const token of ['Bonjour,', 'merci.'])
      await user.click(screen.getByRole('button', { name: token }));
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.click(screen.getByRole('button', { name: /skip this step/i }));
    await user.click(screen.getByRole('button', { name: /look around the course first/i }));
    expect(onFinish).toHaveBeenCalledWith('preview');
  });

  it('moves focus to each new prompt for a keyboard learner', async () => {
    const user = userEvent.setup();
    render(<FirstWinFlow firstWin={french} onFinish={() => {}} />);
    // Not on arrival: the learner pressed a button to get here, so focus stays put.
    expect(screen.getByRole('heading', { name: /start with the sound of it/i })).not.toHaveFocus();
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByRole('heading', { name: /what does it mean/i })).toHaveFocus();
  });

  it('is operable by keyboard alone', async () => {
    const user = userEvent.setup();
    render(<FirstWinFlow firstWin={french} onFinish={() => {}} />);
    // Tab order follows the page: the sound control, the words, then the action.
    // Every one of them is a real button, details/summary or radio — no clickable
    // divs anywhere in the sequence.
    await user.tab();
    expect(screen.getByRole('button', { name: /play the recording/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByText('Show the words')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^continue$/i })).toHaveFocus();
  });

  it('runs the Italian sequence with its own words', async () => {
    await toRecap(italian);
    expect(screen.getByRole('heading', { name: /you just spoke italian/i })).toBeInTheDocument();
    expect(screen.getByText(/picked out the word for thanks/i)).toBeInTheDocument();
    expect(screen.getByText('grazie').closest('[lang]')).toHaveAttribute('lang', 'it');
    expect(screen.getByText('Ciao').closest('[lang]')).toHaveAttribute('lang', 'it');
  });
});
