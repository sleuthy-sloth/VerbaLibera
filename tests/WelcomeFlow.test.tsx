import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow';
import { initialCourses } from '@/features/curriculum/fixture';

afterEach(() => {
  localStorage.clear();
});

describe('WelcomeFlow', () => {
  it('renders a language-first screen with no dashboard or lesson links', () => {
    render(<WelcomeFlow courses={initialCourses} onComplete={() => {}} />);
    expect(screen.getByRole('heading', { name: /what would you like to speak first/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /start learning/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /lesson 0/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open foundations/i })).not.toBeInTheDocument();
  });

  it('disables continue until a language is chosen', () => {
    render(<WelcomeFlow courses={initialCourses} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /continue with your language/i })).toBeDisabled();
  });

  it('enables continue after selecting a language', async () => {
    const user = userEvent.setup();
    render(<WelcomeFlow courses={initialCourses} onComplete={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Italian/i }));
    expect(screen.getByRole('button', { name: /continue with italian/i })).toBeEnabled();
  });

  it('advances to a starting-point screen after continue', async () => {
    const user = userEvent.setup();
    render(<WelcomeFlow courses={initialCourses} onComplete={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Italian/i }));
    await user.click(screen.getByRole('button', { name: /continue with italian/i }));
    expect(screen.getByRole('heading', { name: /where should we start/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start from the beginning/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /i know some already/i })).toBeEnabled();
  });

  it('returns to language selection from the starting-point screen', async () => {
    const user = userEvent.setup();
    render(<WelcomeFlow courses={initialCourses} onComplete={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Italian/i }));
    await user.click(screen.getByRole('button', { name: /continue with italian/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('heading', { name: /what would you like to speak first/i })).toBeInTheDocument();
  });

  it('offers the placement quiz only where an assessment is authored', async () => {
    const user = userEvent.setup();
    render(<WelcomeFlow courses={initialCourses} onComplete={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Italian/i }));
    await user.click(screen.getByRole('button', { name: /continue with italian/i }));
    expect(screen.getByRole('button', { name: /i know some already/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show me the course first/i })).not.toBeInTheDocument();
  });

  it('offers a truthful alternative instead of a quiz for languages without one', async () => {
    const user = userEvent.setup();
    render(<WelcomeFlow courses={initialCourses} onComplete={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Spanish/i }));
    await user.click(screen.getByRole('button', { name: /continue with spanish/i }));
    expect(screen.queryByRole('button', { name: /i know some already/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show me the course first/i })).toBeInTheDocument();
  });

  it('completes onboarding and forwards the destination it chose', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<WelcomeFlow courses={initialCourses} onComplete={onComplete} />);
    await user.click(screen.getByRole('radio', { name: /Italian/i }));
    await user.click(screen.getByRole('button', { name: /continue with italian/i }));
    await user.click(screen.getByRole('button', { name: /start from the beginning/i }));
    expect(onComplete).toHaveBeenCalledWith('/courses/italian?start=1');
    // The completion transition is written by the decision, not by the visit.
    const stored = JSON.parse(localStorage.getItem('verbalibera_onboarding:v1') ?? 'null');
    expect(stored?.status).toBe('completed');
    expect(stored?.entryIntent).toBe('beginner');
  });

  it('sends an unsupported placement choice to the course page', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<WelcomeFlow courses={initialCourses} onComplete={onComplete} />);
    await user.click(screen.getByRole('radio', { name: /Portuguese/i }));
    await user.click(screen.getByRole('button', { name: /continue with portuguese/i }));
    await user.click(screen.getByRole('button', { name: /show me the course first/i }));
    expect(onComplete).toHaveBeenCalledWith('/courses/portuguese');
  });

  it('resumes on the starting-point screen for a learner who left after choosing', () => {
    render(
      <WelcomeFlow
        courses={initialCourses}
        initialState={{ version: 1, courseSlug: 'english-to-italian', status: 'welcome-in-progress' }}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: /where should we start/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start from the beginning/i })).toBeEnabled();
  });

  it('does not overwrite the saved course until the learner continues', async () => {
    const user = userEvent.setup();
    localStorage.setItem('verbalibera_course', 'english-to-italian');
    render(<WelcomeFlow courses={initialCourses} onComplete={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Spanish/i }));
    expect(localStorage.getItem('verbalibera_course')).toBe('english-to-italian');
    await user.click(screen.getByRole('button', { name: /continue with spanish/i }));
    expect(localStorage.getItem('verbalibera_course')).toBe('english-to-spanish');
  });

  it('explains a re-ask when the saved choice could not be read', () => {
    render(
      <WelcomeFlow
        courses={initialCourses}
        notice="We could not read a saved choice on this device, so here it is again."
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText(/could not read a saved choice/i)).toBeInTheDocument();
  });
});