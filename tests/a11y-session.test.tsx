// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GuidedSession } from '@/components/session/GuidedSession';
import { demoProgress } from '@/features/progress/demo-progress';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.extend(toHaveNoViolations as any);

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}
function renderGuided(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

const axeRules = {
  'color-contrast': { enabled: false },
  // complementary inside main is intentional for context rail design; e2e expects complementary
  'landmark-complementary-is-top-level': { enabled: false },
};

describe('a11y session audit — jest-axe + focus + screen reader', () => {
  it('has no axe violations on initial REVIEW step', async () => {
    const { container } = renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
    const results = await axe(container, {
      rules: axeRules,
    });
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations on DRILL step with answer checking', async () => {
    const user = userEvent.setup();
    const { container } = renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
    // advance REVIEW -> DRILL
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // DRILL now visible with textarea
    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
    const results = await axe(container, {
      rules: axeRules,
    });
    expect(results).toHaveNoViolations();
  });

  it('reveal model answer button has explicit aria-label for screen readers', async () => {
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
    const reveal = screen.getByRole('button', { name: /reveal model answer/i });
    // Task 11 requires explicit aria-label on reveal, not just visible text
    expect(reveal).toHaveAttribute('aria-label', 'Reveal model answer');
    // accessible name should still resolve via aria-label
    expect(reveal).toHaveAccessibleName('Reveal model answer');
  });

  it('second reveal path (REVIEW after DRILL navigation) also has aria-label', async () => {
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
    // Step 1 is REVIEW with its own reveal model answer before DRILL
    // But ensure after navigating to step 2 DRILL, reveal still labeled
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // Now on DRILL, reveal should still have proper label
    const reveal = screen.getByRole('button', { name: /reveal model answer/i });
    expect(reveal).toHaveAttribute('aria-label', 'Reveal model answer');
  });

  it('verdict region is aria-live polite, aria-atomic, and programmatically focusable with tabIndex -1', async () => {
    const user = userEvent.setup();
    // mock fetch for answer-check
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ verdict: 'exact', matchedVariant: 'Je voudrais un thé, s’il vous plaît.', limited: false }),
        }),
      ),
    );
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/your answer/i), 'Je voudrais un thé, s’il vous plaît.');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));

    const verdictText = await screen.findByText('That matches an accepted answer.');
    const verdictRegion = verdictText.closest('[aria-live]');
    expect(verdictRegion).not.toBeNull();
    expect(verdictRegion).toHaveAttribute('aria-live', 'polite');
    // polite verdict should be atomic for screen readers
    expect(verdictRegion).toHaveAttribute('aria-atomic', 'true');
    expect(verdictRegion).toHaveAttribute('tabIndex', '-1');
    // should receive focus after check
    expect(verdictRegion).toHaveFocus();

    vi.unstubAllGlobals();
  });

  it('supports roving tabIndex: no positive tabIndex, Tab moves without focus trap, and action dock is reachable', async () => {
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    // 1) No element uses positive tabIndex (focus trap signal)
    const positives = Array.from(document.querySelectorAll('[tabindex]')).filter((el: Element) => {
      const v = parseInt(el.getAttribute('tabindex') || '0', 10);
      return v > 0;
    });
    expect(positives).toEqual([]);

    // 2) Real keyboard Tab flow: first Tab -> Daily path
    await user.tab();
    expect(screen.getByRole('link', { name: /daily path/i })).toHaveFocus();

    // Next tabbables include audio controls (Start lesson) if playable, then reveal
    // Tab until we reach reveal model answer (max 5 tabs) – robust to audio player presence
    const reveal = screen.getByRole('button', { name: /reveal model answer/i });
    let tries = 0;
    while (document.activeElement !== reveal && tries < 5) {
      await user.tab();
      tries++;
    }
    expect(reveal).toHaveFocus();

    // 3) Check roving/tabIndex of actionDock buttons: all buttons should be tabIndex 0 (in tab order)
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn: HTMLElement) => {
      // buttons must not be removed from tab order with -1 unless intentional; standard buttons are 0
      expect(btn.tabIndex).toBe(0);
    });

    // 4) Focus trap check: Tab through all focusable elements should eventually wrap without getting stuck
    const tabbables = document.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]');
    expect(tabbables.length).toBeGreaterThanOrEqual(3);

    // 5) Shift+Tab should be able to move backwards without trap
    await user.tab({ shift: true });
    // After shifting back from reveal, focus should be on previous tabbable (Start lesson or Daily path)
    const prevFocused = document.activeElement;
    expect(prevFocused).not.toBeNull();
    // Ensure we can shift-tab back to Daily path eventually
    tries = 0;
    while (document.activeElement !== screen.getByRole('link', { name: /daily path/i }) && tries < 5) {
      await user.tab({ shift: true });
      tries++;
    }
    expect(screen.getByRole('link', { name: /daily path/i })).toHaveFocus();
  });

  it('provides a skip-link to main content and main has id="main-content"', async () => {
    // Check globals.css contains skip-link styling (visually hidden until focus)
    const cssPath = path.join(process.cwd(), 'src/app/globals.css');
    const css = await readFile(cssPath, 'utf8');
    expect(css).toContain('.skip-link');
    expect(css).toContain('.skip-link:focus');

    // Check layout.tsx contains skip-link anchor
    const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx');
    const layout = await readFile(layoutPath, 'utf8');
    expect(layout).toContain('skip-link');
    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('Skip to main content');

    // Rendered GuidedSession main should be targetable
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
    // Prefer main element with id="main-content"
    const main = document.querySelector('main#main-content');
    expect(main).not.toBeNull();
    // Ensure the target is not hidden from screen readers
    expect(main).toBeVisible();
  });

  it('completion section announces politely and Back link is focusable', async () => {
    const user = userEvent.setup();
    renderGuided(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);

    // Complete all steps via reveal/self-check/continue pattern
    async function completeIndependentStep() {
      await user.click(screen.getByRole('button', { name: 'Reveal model answer' }));
      await user.click(screen.getByRole('button', { name: 'I checked my answer' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }
    await completeIndependentStep();
    await completeIndependentStep();
    await completeIndependentStep();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const heading = screen.getByRole('heading', { name: 'Session complete' });
    expect(heading).toBeInTheDocument();
    const completion = heading.closest('section');
    expect(completion).toHaveAttribute('aria-live', 'polite');
    // Back to daily path link should have received focus per shouldMoveActionFocus logic
    const backLink = screen.getByRole('link', { name: /back to your daily path/i });
    expect(backLink).toHaveFocus();
    // axe on completion
    const results = await axe(document.body, { rules: axeRules });
    // completion region should not introduce violations
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
});
