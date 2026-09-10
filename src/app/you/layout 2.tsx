import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your profile',
  description: 'Your practice, your preferences, and what you can say so far.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
