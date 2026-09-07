import catalog from './catalog.json';

/** Resolve only authored foundation languages, never arbitrary stored paths. */
export function foundationLanguage(courseSlug: string): string | undefined {
  const language = courseSlug.replace(/^english-to-/, '');
  return catalog.find(entry => entry.slug === language)?.slug;
}

export function foundationStartHref(courseSlug: string): string {
  const language = foundationLanguage(courseSlug);
  return language ? `/courses/${language}?start=1` : '/dashboard';
}
