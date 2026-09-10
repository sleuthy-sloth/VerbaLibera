import type { Metadata } from 'next';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';

export const metadata: Metadata = {
  title: 'Today',
  description: "Today's practice path: one pattern, one sentence, and the next step.",
};

export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  const courseQuery = (await searchParams)?.course;
  const requestedCourseSlug = typeof courseQuery === 'string' ? courseQuery : undefined;

  return <DashboardDataBoundary requestedCourseSlug={requestedCourseSlug} />;
}
