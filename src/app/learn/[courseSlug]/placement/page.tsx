import Link from 'next/link';
import { PlacementQuiz } from '@/components/placement/PlacementQuiz';
import { initialCourses } from '@/features/curriculum/fixture';

export default async function PlacementPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);

  if (!course) {
    return (
      <main id="main-content">
        <p>VerbaLibera preview</p>
        <h1>This course is not available in preview.</h1>
        <Link href="/">Return to your daily path</Link>
      </main>
    );
  }

  return <PlacementQuiz courseSlug={courseSlug} />;
}
