import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StoryLayout } from '@/features/course-pack/layouts/StoryLayout';
import { ConversationLayout } from '@/features/course-pack/layouts/ConversationLayout';
import { ListeningLayout } from '@/features/course-pack/layouts/ListeningLayout';

describe('lesson family contexts', () => {
  it.each([
    ['Story', StoryLayout], ['Dialogue', ConversationLayout], ['Audio', ListeningLayout],
  ] as const)('keeps %s available alongside the response', (label, Layout) => {
    const {container} = render(<Layout objective="Order a drink" contextLabel={label}
      context={<p>Reference content</p>} activity={<label>Your reply<input /></label>} />);
    expect(screen.getByText('Order a drink')).toBeVisible();
    expect(screen.getByText('Reference content')).toBeVisible();
    expect(screen.getByRole('textbox', {name:'Your reply'})).toBeVisible();
    const disclosure = container.querySelector('details');
    expect(disclosure).toHaveAttribute('open');
    expect(disclosure?.querySelector('summary')).toHaveTextContent(label);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
