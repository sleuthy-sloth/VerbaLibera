import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audio lessons',
  description: 'Ten-minute audio lessons: a teacher guides you by ear, with a read-along transcript.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
