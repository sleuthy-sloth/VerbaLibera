import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Keep your practice on an account so it follows you across devices.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
