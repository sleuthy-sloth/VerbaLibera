import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';

type HomePageProps = Readonly<{
  searchParams?: Promise<{ course?: string | string[] }>;
}>;

export default async function HomePage({ searchParams }: HomePageProps = {}) {
  const courseQuery = (await searchParams)?.course;
  const requestedCourseSlug = typeof courseQuery === 'string' ? courseQuery : undefined;

  return <DashboardDataBoundary requestedCourseSlug={requestedCourseSlug} />;
}
