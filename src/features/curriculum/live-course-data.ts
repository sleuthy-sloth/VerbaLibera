import frenchManifest from '../../../courses/french/manifest.json';
import italianManifest from '../../../courses/italian/manifest.json';
import spanishManifest from '../../../courses/spanish/manifest.json';
import portugueseManifest from '../../../courses/portuguese/manifest.json';
import germanManifest from '../../../courses/german/manifest.json';

type ManifestLesson = {
  exercises?: unknown[];
  steps?: unknown[];
  [key: string]: unknown;
};

type ManifestLike = {
  title?: string;
  description?: string;
  lessons?: ManifestLesson[];
  concepts?: unknown[];
  [key: string]: unknown;
};

export type LiveCourseStats = {
  slug: string;
  totalLessons: number;
  totalSteps: number;
  title: string;
  description: string;
};

function countStepsFromManifest(manifest: ManifestLike): number {
  return (manifest.lessons ?? []).reduce(
    (sum, lesson) => sum + Math.max(lesson.exercises?.length ?? 0, lesson.steps?.length ?? 0),
    0
  );
}

const manifests = [
  { slug: 'french', manifest: frenchManifest as unknown as ManifestLike },
  { slug: 'italian', manifest: italianManifest as unknown as ManifestLike },
  { slug: 'spanish', manifest: spanishManifest as unknown as ManifestLike },
  { slug: 'portuguese', manifest: portugueseManifest as unknown as ManifestLike },
  { slug: 'german', manifest: germanManifest as unknown as ManifestLike },
] as const;

export function getLiveCourseData(): LiveCourseStats[] {
  return manifests.map(({ slug, manifest }) => ({
    slug,
    totalLessons: manifest.lessons?.length ?? 0,
    totalSteps: countStepsFromManifest(manifest),
    title: manifest.title ?? slug,
    description: manifest.description ?? '',
  }));
}
