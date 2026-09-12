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
import { packSlugFor } from "./course-identity";

const CODE_BY_LANGUAGE: Record<string, string> = {
  french: 'fr',
  italian: 'it',
  spanish: 'es',
  portuguese: 'pt',
  german: 'de',
  english: 'en',
};

export function langCodeFor(courseSlugOrLanguage: string | null | undefined): string | undefined {
  // `english` is not a course, so it is matched before the course universe is
  // consulted: `packSlugFor("english")` is deliberately undefined.
  if (!courseSlugOrLanguage) return undefined;
  const value = courseSlugOrLanguage.toLowerCase();
  if (value === 'english') return CODE_BY_LANGUAGE.english;
  const language = packSlugFor(value);
  return language ? CODE_BY_LANGUAGE[language] : undefined;
}
