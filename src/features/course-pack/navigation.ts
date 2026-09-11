import catalog from './catalog.json';

export type FoundationCatalogEntry = Readonly<{
  slug: string;
  title: string;
  lessons: number;
  units: number;
  practiceActivities: number;
}>;

/**
 * Generated pack facts, read from the same reports that govern content
 * decisions. Adding a field here means regenerating with `content:build`.
 */
export const foundationCatalog: readonly FoundationCatalogEntry[] = catalog;

/** Resolve only authored foundation languages, never arbitrary stored paths. */
export function foundationLanguage(courseSlug: string): string | undefined {
  const language = courseSlug.replace(/^english-to-/, '');
  return foundationCatalog.find(entry => entry.slug === language)?.slug;
}

export function foundationCatalogEntry(courseSlug: string): FoundationCatalogEntry | undefined {
  const language = courseSlug.replace(/^english-to-/, '');
  return foundationCatalog.find(entry => entry.slug === language);
}

export function foundationStartHref(courseSlug: string): string {
  const language = foundationLanguage(courseSlug);
  return language ? `/courses/${language}?start=1` : '/dashboard';
}
