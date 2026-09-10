import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { PlacementQuiz } from '@/components/placement/PlacementQuiz';
import { initialCourses } from '@/features/curriculum/fixture';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { verifySessionToken } from '@/lib/auth/session';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}): Promise<Metadata> {
  const { courseSlug } = await params;
  if (!initialCourses.some((candidate) => candidate.slug === courseSlug)) notFound();
  return { title: 'Placement quiz' };
}

/** Only the authored guided courses exist; anything else is a router-level 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return initialCourses.map((course) => ({ courseSlug: course.slug }));
}

export default async function PlacementPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);

  if (!course) notFound();

  const token = sessionTokenFromCookies((await cookies()).toString());
  const session = token ? await verifySessionToken(token) : null;
  return <PlacementQuiz key={`${courseSlug}:${session?.userId ?? 'guest'}`} courseSlug={courseSlug} userId={session?.userId ?? null} />;
}
