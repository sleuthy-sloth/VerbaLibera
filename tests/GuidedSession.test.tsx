import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidedSession } from '@/components/session/GuidedSession';
import { demoProgress } from '@/features/progress/demo-progress';

describe('GuidedSession', () => {
  it('uses one stepline instead of a duplicated step rail', () => {
    // Break caught: session progress is duplicated in a separate navigation rail.
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    expect(screen.getByText(/step 1 of 4 · review/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /session steps/i })).not.toBeInTheDocument();
  });

  it('withholds the answer until explicit reveal and resets it on advance', async () => {
    // Break caught: the model answer is visible before the learner deliberately reveals it.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    expect(screen.queryByText('Je voudrais un café, s’il vous plaît.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reveal model answer/i }));
    expect(screen.getByText('Je voudrais un café, s’il vous plaît.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.queryByText('Je voudrais un café, s’il vous plaît.')).not.toBeInTheDocument();
  });

  it('keeps unavailable fixture audio honest', () => {
    // Break caught: the preview offers playback for fixture audio that is not actually available.
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    expect(screen.getByText(/audio isn't available for this preview/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play prompt/i })).not.toBeInTheDocument();
  });

  it('advances through the bounded preview and celebrates completion', async () => {
    // Break caught: Continue does not advance every preview step to a finite completion state.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    await user.click(continueButton);
    await user.click(continueButton);
    await user.click(continueButton);
    await user.click(continueButton);

    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(screen.getByText(/preview xp/i)).toBeInTheDocument();
  });

  it('renders an honest unavailable state for an unknown course slug', () => {
    // Break caught: unknown URLs leak steps from a different course.
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-german" />);

    expect(screen.getByText('This course is not available in preview.')).toBeInTheDocument();
    expect(screen.queryByText('Drill sprint')).not.toBeInTheDocument();
  });
});
