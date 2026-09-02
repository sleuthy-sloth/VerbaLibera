import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const courseQuery = (await searchParams)?.course;
  const requestedCourseSlug = typeof courseQuery === 'string' ? courseQuery : undefined;

  return <DashboardDataBoundary requestedCourseSlug={requestedCourseSlug} />;
}
