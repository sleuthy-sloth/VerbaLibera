import { cookies } from 'next/headers';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { verifySessionToken } from '@/lib/auth/session';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlanSection } from '@/components/plan/PlanSection';
import { initialCourses } from '@/features/curriculum/fixture';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}): Promise<Metadata> {
  const { courseSlug } = await params;
  if (!initialCourses.some((course) => course.slug === courseSlug)) notFound();
  return { title: 'Your study plan' };
}

/** Only the authored guided courses exist; anything else is a router-level 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return initialCourses.map((course) => ({ courseSlug: course.slug }));
}

export default async function StudyPlanPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const hasCourse = initialCourses.some((course) => course.slug === courseSlug);

  if (!hasCourse) notFound();

  const token = sessionTokenFromCookies((await cookies()).toString());
  const session = token ? await verifySessionToken(token) : null;
  return <PlanSection key={`${courseSlug}:${session?.userId ?? 'guest'}`} courseSlug={courseSlug} userId={session?.userId ?? null} />;
}
