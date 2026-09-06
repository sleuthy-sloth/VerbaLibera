import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '@/app/page';

it('introduces the product and leads into real learning and account routes', async () => {
  render(HomePage());
  expect(screen.getByRole('heading', { level: 1, name: /Stop guessing. Start building sentences./ })).toBeInTheDocument();
  for (const link of screen.getAllByRole('link', { name: 'Start learning' })) expect(link).toHaveAttribute('href', '/dashboard');
  expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: /Explore French/ })).toHaveAttribute('href', '/courses/french');
  expect(screen.getByRole('link', { name: /Explore Italian/ })).toHaveAttribute('href', '/courses/italian');
});

it('lets a visitor reveal and hide a model sentence without leaving the page', async () => {
  render(HomePage());
  const user = userEvent.setup();
  const button = screen.getByRole('button', { name: 'Reveal model answer' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Je voudrais une table.')).toBeVisible();
  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
});
