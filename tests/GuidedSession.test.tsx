import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidedSession } from '@/components/session/GuidedSession';
import { demoProgress } from '@/features/progress/demo-progress';

describe('GuidedSession', () => {
  it('orders reviews before the drill sprint and new pattern', () => {
    // Break caught: the guided path stops honoring review-first session composition.
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    const review = screen.getByText('Review 1');
    const drill = screen.getByText('Drill sprint');
    const pattern = screen.getByText('New pattern');

    expect(review.compareDocumentPosition(drill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(drill.compareDocumentPosition(pattern) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: /session progress/i })).toHaveAttribute(
      'aria-valuetext',
      'Step 1 of 4',
    );
    expect(screen.getByText(/audio isn’t included in this preview yet/i)).toBeInTheDocument();
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
