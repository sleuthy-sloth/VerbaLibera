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

  if (courseSlug !== 'english-to-french') {
    return (
      <main id="main-content">
        <p>VerbaLibera preview</p>
        <h1>Placement is French-first for now.</h1>
        <p>More languages follow the same 15-question template once their items are authored.</p>
        <Link href={`/learn/${courseSlug}`}>Back to {course.title}</Link>
      </main>
    );
  }

  return <PlacementQuiz courseSlug={courseSlug} />;
}
