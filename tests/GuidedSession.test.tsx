import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidedSession } from '@/components/session/GuidedSession';
import { demoProgress } from '@/features/progress/demo-progress';

describe('GuidedSession', () => {
  async function completeIndependentStep(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    await user.click(screen.getByRole('button', { name: 'I checked my answer' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
  }

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

  it('renders the exact review, drill, drill, new-pattern sequence', async () => {
    // Break caught: the guided path stops honoring review-first session composition.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    expect(screen.getByRole('progressbar', { name: /session progress/i })).toHaveAttribute(
      'aria-valuetext',
      'Step 1 of 4',
    );
    expect(screen.getByText(/step 1 of 4 · review/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 2 of 4 · drill sprint/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 3 of 4 · drill sprint/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 4 of 4 · new pattern/i)).toBeInTheDocument();
  });

  it('renders the audio player for French polite ordering when every segment is playable', async () => {
    // Break caught: a fully authored pilot lesson stays on the text-only fallback instead of exposing its player.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    expect(screen.getByRole('region', { name: /lesson audio player/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start lesson/i })).toBeInTheDocument();
    expect(screen.queryByText(/audio isn’t included in this preview yet/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    expect(screen.getByText('Je voudrais un café, s’il vous plaît.')).toBeInTheDocument();
  });

  it('keeps unavailable Italian audio on the text-only reveal and self-check path', async () => {
    // Break caught: unavailable audio blocks an Italian learner from revealing and self-checking the authored response.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-italian" />);

    expect(screen.queryByRole('region', { name: /lesson audio player/i })).not.toBeInTheDocument();
    expect(screen.getByText(/audio isn’t included in this preview yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play prompt/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    expect(screen.getByText('Vorrei un caffè, per favore.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I checked my answer' }));
    expect(screen.getByText(/this is a preview—nothing was saved/i)).toBeInTheDocument();
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

  it('moves focus to each replacement primary action', async () => {
    // Break caught: replacing the clicked action drops keyboard focus back to the document body.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    expect(screen.getByRole('button', { name: 'I checked my answer' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'I checked my answer' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Reveal model answer' })).toHaveFocus();
  });

  it('moves focus from the last continue action to the dashboard return link', async () => {
    // Break caught: finishing the final card leaves focus on a removed Continue button.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('link', { name: /back to your daily path/i })).toHaveFocus();
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

  it('returns lesson exits and completion to the selected course dashboard', async () => {
    // Break caught: leaving or completing an Italian lesson silently resets dashboard selection.
    const user = userEvent.setup();
    render(<GuidedSession progress={demoProgress} courseSlug="english-to-italian" />);

    expect(screen.getByRole('link', { name: /daily path/i })).toHaveAttribute(
      'href',
      '/?course=english-to-italian',
    );

    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('link', { name: /back to your daily path/i })).toHaveAttribute(
      'href',
      '/?course=english-to-italian',
    );
  });
});
