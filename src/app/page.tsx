import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

const title = 'VerbaLibera — Learn Languages by Building Sentences';
const description = 'Structured language learning through sentence construction, deliberate practice, listening, and offline study — without streak pressure or a required AI runtime.';
export const metadata: Metadata = {
  title, description,
  openGraph: { title, description, url: '/', siteName: 'VerbaLibera', images: [{ url: '/og-card.jpg', width: 1200, height: 630, alt: 'VerbaLibera — learn by building sentences' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-card.jpg'] },
};

export default function HomePage() {
  return <LandingPage />;
}
