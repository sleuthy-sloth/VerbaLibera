import { initialCourses } from '@/features/curriculum/fixture';
import type { ConceptFixture, CourseFixture, DrillFixture } from '@/features/curriculum/types';

export type ResolvedSessionContent = Readonly<{
  course: CourseFixture;
  concept: ConceptFixture;
  drill: DrillFixture | null;
}>;

export function resolveSessionContent(courseSlug: string, contentId: string, drillId?: string): ResolvedSessionContent | null {
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);
  const concept = course?.concepts.find((candidate) => candidate.id === contentId);
  if (!course || !concept) return null;
  const drill = drillId ? concept.drills.find((candidate) => candidate.id === drillId) ?? null : null;
  return drillId && !drill ? null : { course, concept, drill };
}
