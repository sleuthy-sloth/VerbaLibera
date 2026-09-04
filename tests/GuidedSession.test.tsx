import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { GuidedSession } from '@/components/session/GuidedSession';
import { demoProgress } from '@/features/progress/demo-progress';

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}
function renderGuided(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}


describe('GuidedSession', () => {
  async function completeIndependentStep(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    await user.click(screen.getByRole('button', { name: 'I checked my answer' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
  }

  it('uses one stepline instead of a duplicated step rail', () => {
    // Break caught: session progress is duplicated in a separate navigation rail.
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    expect(screen.getByText(/step 1 of 8 · new pattern/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /session steps/i })).not.toBeInTheDocument();
  });

  it('teaches the pattern up front, then withholds later answers until reveal', async () => {
    // Break caught: the session opens by demanding production of unseen language.
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    // Step 1 is the new pattern: the model dialogue is taught, not tested.
    expect(screen.getByText('Bonjour, je voudrais une table, s’il vous plaît.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reveal model answer/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    // Step 2 withholds its own answer until explicit reveal and resets it on advance.
    expect(screen.queryByText('Je voudrais un café, s’il vous plaît.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reveal model answer/i }));
    expect(screen.getByText('Je voudrais un café, s’il vous plaît.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.queryByText('Je voudrais un café, s’il vous plaît.')).not.toBeInTheDocument();
  });

  it('renders the exact new-pattern, review, drill, drill, picture, picture, listen, builder sequence', async () => {
    // Break caught: the guided path stops teaching the new pattern before testing it.
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    expect(screen.getByRole('progressbar', { name: /session progress/i })).toHaveAttribute(
      'aria-valuetext',
      'Step 1 of 8',
    );
    expect(screen.getByText(/step 1 of 8 · new pattern/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 2 of 8 · review/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 3 of 8 · drill sprint/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 4 of 8 · drill sprint/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 5 of 8 · drill sprint/i)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /picture choices/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 6 of 8 · drill sprint/i)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /picture choices/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 7 of 8 · drill sprint/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/step 8 of 8 · drill sprint/i)).toBeInTheDocument();
  });

  it('renders the audio player for French polite ordering when every segment is playable', async () => {
    // Break caught: a fully authored pilot lesson stays on the text-only fallback instead of exposing its player.
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    // Step 1 teaches the greeting with its own audio…
    expect(screen.getByRole('region', { name: /lesson audio player/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start lesson/i })).toBeInTheDocument();
    expect(screen.queryByText(/audio isn’t included in this preview yet/i)).not.toBeInTheDocument();
    expect(screen.getByText('Bonjour, je voudrais une table, s’il vous plaît.')).toBeInTheDocument();

    // …step 2 reviews ordering with the same player treatment.
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('region', { name: /lesson audio player/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    expect(screen.getByText('Je voudrais un café, s’il vous plaît.')).toBeInTheDocument();
  });

  it('renders real Kokoro audio for the Italian ordering step', async () => {
    // Break caught: a shipped pattern still falls back to the "audio isn't included" preview state.
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-italian" />);

    expect(screen.getByRole('region', { name: /lesson audio player/i })).toBeInTheDocument();
    expect(screen.queryByText(/audio isn’t included in this preview yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start lesson/i })).toBeInTheDocument();
    expect(screen.getByText('Buongiorno, vorrei un tavolo, per favore.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
    expect(screen.getByText('Vorrei un caffè, per favore.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I checked my answer' }));
    expect(screen.getByText(/this is a preview—nothing was saved/i)).toBeInTheDocument();
  });

  it('advances through the bounded preview and celebrates completion', async () => {
    // Break caught: Continue does not advance every preview step to a finite completion state.
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(screen.getByText(/preview xp/i)).toBeInTheDocument();
  });

  it('renders an honest unavailable state for an unknown course slug', () => {
    // Break caught: unknown URLs leak steps from a different course.
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-german" />);

    expect(screen.getByText('This course is not available in preview.')).toBeInTheDocument();
    expect(screen.queryByText('Drill sprint')).not.toBeInTheDocument();
  });

  it('renders the active step’s scenario instead of the first course pattern', async () => {
    // Break caught: a later step renders the first course pattern rather than its resolved content.
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await completeIndependentStep(user);
    await completeIndependentStep(user);

    expect(screen.getByText(/finding a place/i)).toBeInTheDocument();
  });

  it('hides a model answer until the learner deliberately reveals and self-checks it', async () => {
    // Break caught: an independent answer is exposed before the learner chooses to reveal it.
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
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
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    // Step 1 teaches with a single Continue primary action…
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // …step 2 review hands focus to its reveal action.
    expect(screen.getByRole('button', { name: 'Reveal model answer' })).toHaveFocus();

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
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
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

    renderGuided(<GuidedSession progress={progressWithMissingStep} courseSlug="english-to-french" />);

    expect(screen.getByText(/this lesson step is not available in preview/i)).toBeInTheDocument();
    expect(screen.queryByText(/ordering coffee or food/i)).not.toBeInTheDocument();
  });

  it('returns lesson exits and completion to the selected course dashboard', async () => {
    // Break caught: leaving or completing an Italian lesson silently resets dashboard selection.
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-italian" />);

    expect(screen.getByRole('link', { name: /daily path/i })).toHaveAttribute(
      'href',
      '/?course=english-to-italian',
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await completeIndependentStep(user);
    await completeIndependentStep(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('link', { name: /back to your daily path/i })).toHaveAttribute(
      'href',
      '/?course=english-to-italian',
    );
  });
});

describe('typed answer checking on DRILL steps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('input is absent on teaching and review steps, present on the drill step', async () => {
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    // Step 1 teaches the new pattern: no production demanded.
    expect(screen.queryByLabelText(/your answer/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // Step 2 reviews: still no typing.
    expect(screen.queryByLabelText(/your answer/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // Step 3 drills: typing begins only after teaching.
    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
  });

  it('shows exact verdict and checked-locally note for a matching answer', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              verdict: 'exact',
              matchedVariant: 'Je voudrais un thé, s’il vous plaît.',
              limited: false,
            }),
        }),
      ),
    );
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'Je voudrais un thé, s’il vous plaît.');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));

    expect(await screen.findByText('That matches an accepted answer.')).toBeInTheDocument();
    expect(screen.getByText('Checked locally. Nothing was saved.')).toBeInTheDocument();
  });

  it('shows close verdict with matched variant hint', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              verdict: 'close',
              matchedVariant: 'Je voudrais un thé, s’il vous plaît.',
              limited: false,
            }),
        }),
      ),
    );
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'Je voudrais un the s il vous plait');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));

    expect(await screen.findByText('Close — compare with the accepted answer.')).toBeInTheDocument();
    expect(screen.getByText('Je voudrais un thé, s’il vous plaît.')).toBeInTheDocument();
    expect(screen.getByText('Checked locally. Nothing was saved.')).toBeInTheDocument();
  });

  it('shows try-again verdict with checked-locally note', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ verdict: 'try_again', limited: false }),
        }),
      ),
    );
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'completely wrong');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));

    expect(await screen.findByText('Try again, or reveal the model answer.')).toBeInTheDocument();
    expect(screen.getByText('Checked locally. Nothing was saved.')).toBeInTheDocument();
  });

  it('shows limited unavailable copy when fetch rejects and omits checked-locally note', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'anything');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));

    expect(
      await screen.findByText('Local checking is unavailable right now — compare with the model answer.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Checked locally. Nothing was saved.')).not.toBeInTheDocument();
  });

  it('keeps reveal model answer independent of checking', async () => {
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));

    expect(screen.getByText('Je voudrais un thé, s’il vous plaît.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I checked my answer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check my answer' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/your answer/i)).not.toBeInTheDocument();
  });

  it('moves focus to the verdict region after check resolves', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              verdict: 'exact',
              matchedVariant: 'Je voudrais un thé, s’il vous plaît.',
              limited: false,
            }),
        }),
      ),
    );
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'test');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));

    const verdictText = await screen.findByText('That matches an accepted answer.');
    expect(verdictText.closest('[tabindex="-1"]')).toHaveFocus();
  });

  it('clears verdict after advancing to the next step', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              verdict: 'exact',
              matchedVariant: 'Je voudrais un thé, s’il vous plaît.',
              limited: false,
            }),
        }),
      ),
    );
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'test');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(await screen.findByText('That matches an accepted answer.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByText('That matches an accepted answer.')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/your answer/i)).toHaveValue('');
  });

  it('shows Checking… while the request is pending', async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'test');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));

    expect(screen.getByRole('button', { name: 'Checking…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();

    resolveFetch!({
      ok: true,
      json: () => Promise.resolve({ verdict: 'exact', matchedVariant: 'Je voudrais un thé, s’il vous plaît.', limited: false }),
    });

    await screen.findByText('That matches an accepted answer.');
    expect(screen.getByRole('button', { name: 'Check my answer' })).toBeInTheDocument();
  });
});
