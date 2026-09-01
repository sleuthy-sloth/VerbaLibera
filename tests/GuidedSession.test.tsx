import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidedSession } from '@/components/session/GuidedSession';
import { demoProgress } from '@/features/progress/demo-progress';

describe('GuidedSession', () => {
  async function completeIndependentStep(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    await user.click(screen.getByRole('button', { name: 'I checked my answer' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
  }

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

    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(screen.getByText(/preview xp/i)).toBeInTheDocument();
  });

  it('renders an honest unavailable state for an unknown course slug', () => {
    // Break caught: unknown URLs leak steps from a different course.
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-german" />);

    expect(screen.getByText('This course is not available in preview.')).toBeInTheDocument();
    expect(screen.queryByText('Drill sprint')).not.toBeInTheDocument();
  });

  it('renders the active step’s scenario instead of the first course pattern', async () => {
    // Break caught: a later step renders the first course pattern rather than its resolved content.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await completeIndependentStep(user);
    await completeIndependentStep(user);

    expect(screen.getByText(/finding a place/i)).toBeInTheDocument();
  });

  it('hides a model answer until the learner deliberately reveals and self-checks it', async () => {
    // Break caught: an independent answer is exposed before the learner chooses to reveal it.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    expect(screen.queryByText('Je voudrais un café, s’il vous plaît.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    expect(screen.getByText('Je voudrais un café, s’il vous plaît.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I checked my answer' }));

    expect(screen.getByText(/this is a preview—nothing was saved/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('renders an honest unavailable state for a step with unresolved content', () => {
    // Break caught: a malformed step silently falls back to a different lesson.
    const progressWithMissingStep = {
      ...demoProgress,
      session: [
        {
          id: 'missing-step',
          kind: 'REVIEW' as const,
          courseSlug: 'english-to-french' as const,
          contentId: 'missing-pattern',
        },
      ],
    };

    render(<GuidedSession progress={progressWithMissingStep} courseSlug="english-to-french" />);

    expect(screen.getByText(/this lesson step is not available in preview/i)).toBeInTheDocument();
    expect(screen.queryByText(/ordering coffee or food/i)).not.toBeInTheDocument();
  });
});
