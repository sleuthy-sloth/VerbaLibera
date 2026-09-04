import Link from 'next/link';
import { PlanSection } from '@/components/plan/PlanSection';
import { initialCourses } from '@/features/curriculum/fixture';

export default async function StudyPlanPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const hasCourse = initialCourses.some((course) => course.slug === courseSlug);

  if (!hasCourse) {
    return (
      <main id="main-content">
        <p>VerbaLibera preview</p>
        <h1>This course is not available in preview.</h1>
        <Link href="/">Return to your daily path</Link>
      </main>
    );
  }

  return <PlanSection courseSlug={courseSlug} />;
}
