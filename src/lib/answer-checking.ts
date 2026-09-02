import 'server-only';

import { resolveSessionContent } from '@/features/session/resolve-session-content';

export const SIMILARITY_CLOSE_THRESHOLD = 0.60;

const ENGLISH_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'i',
  'you',
  'we',
  'he',
  'she',
  'it',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'our',
  'their',
  'would',
  'like',
  'want',
  'to',
  'please',
  'in',
  'at',
  'of',
  'and',
  'or',
  'is',
  'are',
  'am',
  'was',
  'were',
  'be',
  'been',
  'do',
  'does',
  'did',
  'can',
  'could',
  'will',
  'for',
  'with',
  'on',
  'by',
]);

export type AnswerCheckVerdict = 'exact' | 'close' | 'try_again';

export type AnswerCheckResult = Readonly<{
  verdict: AnswerCheckVerdict;
  matchedVariant?: string;
  limited: boolean;
}>;

export type AnswerCheckInput = Readonly<{
  courseSlug: string;
  contentId: string;
  drillId: string;
  response: string;
}>;

export function normalizeAnswerText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/'/g, '’')
    .toLowerCase()
    .replace(/^["'\u2018\u2019]+|["'\u2018\u2019]+$/g, '')
    .replace(/[.!?]+$/, '');
}

function localServiceUrl(serviceUrl?: string): string | undefined {
  const configuredUrl = serviceUrl ?? process.env.VOXLIBRE_VOICE_SERVICE_URL;
  return configuredUrl?.trim() || undefined;
}

function localEndpoint(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

function tokenizeContentWords(text: string): Map<string, number> {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (ENGLISH_STOP_WORDS.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function countTotal(counts: Map<string, number>): number {
  let total = 0;
  for (const count of counts.values()) {
    total += count;
  }
  return total;
}

export function contentWordF1(left: string, right: string): number {
  const leftWords = tokenizeContentWords(left);
  const rightWords = tokenizeContentWords(right);

  if (leftWords.size === 0 && rightWords.size === 0) {
    return 1;
  }
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const [word, count] of leftWords) {
    overlap += Math.min(count, rightWords.get(word) ?? 0);
  }

  const precision = overlap / countTotal(leftWords);
  const recall = overlap / countTotal(rightWords);
  if (precision + recall === 0) {
    return 0;
  }
  return (2 * precision * recall) / (precision + recall);
}

export async function checkDrillAnswer(
  input: AnswerCheckInput,
  options?: { serviceUrl?: string; fetchImpl?: typeof fetch },
): Promise<AnswerCheckResult | null> {
  const resolved = resolveSessionContent(input.courseSlug, input.contentId, input.drillId);
  if (!resolved?.drill) {
    return null;
  }

  const drill = resolved.drill;
  const variants = [...drill.acceptedResponses, drill.recallTarget];
  const normalizedResponse = normalizeAnswerText(input.response);

  const uniqueVariants = new Map<string, string>();
  for (const variant of variants) {
    const normalized = normalizeAnswerText(variant);
    if (!uniqueVariants.has(normalized)) {
      uniqueVariants.set(normalized, variant);
    }
  }

  if (uniqueVariants.has(normalizedResponse)) {
    return {
      verdict: 'exact',
      matchedVariant: uniqueVariants.get(normalizedResponse),
      limited: false,
    };
  }

  const serviceUrl = localServiceUrl(options?.serviceUrl);
  if (!serviceUrl) {
    return { verdict: 'try_again', limited: true };
  }

  try {
    const fetchImpl = options?.fetchImpl ?? fetch;
    const sourceLanguageCode = resolved.course.targetLanguageCode;

    const translate = async (text: string): Promise<string> => {
      const response = await fetchImpl(localEndpoint(serviceUrl, '/translate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ text, source: sourceLanguageCode, target: 'en' }),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('translation request failed');
      }
      const data = (await response.json()) as unknown;
      if (!data || typeof (data as { translation?: unknown }).translation !== 'string') {
        throw new Error('translation response missing translation field');
      }
      return (data as { translation: string }).translation;
    };

    const originals = [...uniqueVariants.values()];
    const [responseTranslation, ...variantTranslations] = await Promise.all([
      translate(normalizedResponse),
      ...originals.map((variant) => translate(variant)),
    ]);

    let bestScore = -1;
    let bestIndex = -1;
    for (let index = 0; index < variantTranslations.length; index++) {
      const score = contentWordF1(responseTranslation, variantTranslations[index]!);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestScore >= SIMILARITY_CLOSE_THRESHOLD) {
      return {
        verdict: 'close',
        matchedVariant: originals[bestIndex],
        limited: false,
      };
    }
    return { verdict: 'try_again', limited: false };
  } catch {
    return { verdict: 'try_again', limited: true };
  }
}
