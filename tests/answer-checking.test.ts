import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SIMILARITY_CLOSE_THRESHOLD,
  checkDrillAnswer,
  contentWordF1,
  normalizeAnswerText,
} from '@/lib/answer-checking';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('normalizeAnswerText', () => {
  it.each([
    { raw: '  Je voudrais  un café, s\'il vous plaît.  ', expected: 'je voudrais un café, s’il vous plaît' },
    { raw: 'Je voudrais un café!', expected: 'je voudrais un café' },
    { raw: "'Je voudrais un café'", expected: 'je voudrais un café' },
    { raw: 'Je voudrais un café', expected: 'je voudrais un café' },
    { raw: "é", expected: 'é' },
    { raw: "Je voudrais l'entrée", expected: 'je voudrais l’entrée' },
  ])('normalizes "$raw" to "$expected"', ({ raw, expected }) => {
    expect(normalizeAnswerText(raw)).toBe(expected);
  });
});

describe('checkDrillAnswer', () => {
  it('returns exact when response matches a real fixture accepted response', async () => {
    const result = await checkDrillAnswer({
      courseSlug: 'english-to-french',
      contentId: 'fr-ordering-politely',
      drillId: 'fr-ordering-politely-drill',
      response: 'Je voudrais un thé, s’il vous plaît.',
    });

    expect(result).toEqual({
      verdict: 'exact',
      matchedVariant: 'Je voudrais un thé, s’il vous plaît.',
      limited: false,
    });
  });

  it('returns null for an unresolvable drill', async () => {
    const result = await checkDrillAnswer({
      courseSlug: 'english-to-french',
      contentId: 'missing-pattern',
      drillId: 'fr-ordering-politely-drill',
      response: 'Je voudrais un thé, s’il vous plaît.',
    });

    expect(result).toBeNull();
  });

  describe('meaning path with stubbed translation service', () => {
    it('returns close when translation is near-identical to variant', async () => {
      vi.stubEnv('VOXLIBRE_VOICE_SERVICE_URL', 'http://localhost:8000');
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ translation: 'I would like a tea, please.' })),
      );

      const result = await checkDrillAnswer({
        courseSlug: 'english-to-french',
        contentId: 'fr-ordering-politely',
        drillId: 'fr-ordering-politely-drill',
        response: "Je voudrais un thé, s'il vous plaît.",
      });

      expect(result).toEqual({
        verdict: 'close',
        matchedVariant: 'Je voudrais un thé, s’il vous plaît.',
        limited: false,
      });
    });

    it('returns try_again when content words differ', async () => {
      vi.stubEnv('VOXLIBRE_VOICE_SERVICE_URL', 'http://localhost:8000');
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ translation: 'I would like a coffee, please.' })),
      );

      const result = await checkDrillAnswer({
        courseSlug: 'english-to-french',
        contentId: 'fr-ordering-politely',
        drillId: 'fr-ordering-politely-drill',
        response: "Je voudrais un café, s'il vous plaît.",
      });

      expect(result).toEqual({ verdict: 'try_again', limited: false });
    });

    it('returns close at the exact 0.60 threshold', async () => {
      vi.stubEnv('VOXLIBRE_VOICE_SERVICE_URL', 'http://localhost:8000');
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ translation: 'a b c d e' })),
      );

      const result = await checkDrillAnswer({
        courseSlug: 'english-to-french',
        contentId: 'fr-ordering-politely',
        drillId: 'fr-ordering-politely-drill',
        response: 'a b c x y',
      });

      expect(result?.verdict).toBe('close');
      expect(result?.limited).toBe(false);
    });
  });

  describe('fallbacks', () => {
    it('returns limited try_again when no service URL is configured', async () => {
      vi.stubEnv('VOXLIBRE_VOICE_SERVICE_URL', '');

      const result = await checkDrillAnswer({
        courseSlug: 'english-to-french',
        contentId: 'fr-ordering-politely',
        drillId: 'fr-ordering-politely-drill',
        response: 'Je voudrais un thé.',
      });

      expect(result).toEqual({ verdict: 'try_again', limited: true });
    });

    it('returns limited try_again when fetch rejects', async () => {
      vi.stubEnv('VOXLIBRE_VOICE_SERVICE_URL', 'http://localhost:8000');
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('connection refused'))));

      const result = await checkDrillAnswer({
        courseSlug: 'english-to-french',
        contentId: 'fr-ordering-politely',
        drillId: 'fr-ordering-politely-drill',
        response: 'Je voudrais un thé.',
      });

      expect(result).toEqual({ verdict: 'try_again', limited: true });
    });
  });
});

describe('contentWordF1', () => {
  it('returns 1 for identical strings', () => {
    expect(contentWordF1('I want coffee', 'I want coffee')).toBe(1);
  });

  it('returns 0 for disjoint content words', () => {
    expect(contentWordF1('I would like a coffee', 'I would like a tea')).toBe(0);
  });

  it('ignores stop-word-only differences', () => {
    expect(contentWordF1('I would like a coffee', 'would like the coffee')).toBe(1);
  });

  it('returns the expected score for partial overlap', () => {
    // precision = 3/5, recall = 3/5 => F1 = 0.6
    expect(contentWordF1('a b c d e', 'a b c x y')).toBe(SIMILARITY_CLOSE_THRESHOLD);
  });
});
