/**
 * BCP-47 codes for the target languages.
 *
 * Screen readers pronounce text according to the `lang` attribute. The landing
 * page marked its French and Italian phrases correctly; the actual lessons,
 * drills, vocabulary lists and audio transcripts marked nothing, so «Je
 * voudrais» was read aloud with English phonemes — the one place where getting
 * it wrong matters most.
 *
 * Accepts either form the codebase uses: a foundation slug (`french`), a legacy
 * course slug (`english-to-french`), or an already-correct code (`fr`).
 */
const CODE_BY_LANGUAGE: Record<string, string> = {
  french: 'fr',
  italian: 'it',
  spanish: 'es',
  portuguese: 'pt',
  german: 'de',
  english: 'en',
};

export function langCodeFor(courseSlugOrLanguage: string | null | undefined): string | undefined {
  if (!courseSlugOrLanguage) return undefined;
  const language = courseSlugOrLanguage.replace(/^english-to-/, '').toLowerCase();
  return CODE_BY_LANGUAGE[language];
}
