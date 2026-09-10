import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow';
import { initialCourses } from '@/features/curriculum/fixture';

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
});