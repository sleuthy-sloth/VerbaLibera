import { GuidedSession } from '@/components/session/GuidedSession';
import { SendToAnki } from '@/components/anki/SendToAnki';
import { initialCourses } from '@/features/curriculum/fixture';
import { demoProgress } from '@/features/progress/demo-progress';

export default async function LearnPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const hasCourse = initialCourses.some((course) => course.slug === courseSlug);

  return (
    <>
      <GuidedSession
        courseSlug={hasCourse ? courseSlug : '__unavailable__'}
        progress={demoProgress}
      />
      {hasCourse ? <SendToAnki courseSlug={courseSlug} /> : null}
    </>
  );
}
