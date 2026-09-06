import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';

export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  const courseQuery = (await searchParams)?.course;
  const requestedCourseSlug = typeof courseQuery === 'string' ? courseQuery : undefined;

  return <DashboardDataBoundary requestedCourseSlug={requestedCourseSlug} />;
}
