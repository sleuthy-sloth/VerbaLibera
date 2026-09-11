import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  firstWinFor,
  firstWinStepCount,
  hasFirstWin,
  type FirstWinStep,
} from '@/features/onboarding/first-win';

/**
 * The first-win sequence's content contract (roadmap 1B).
 *
 * These are the properties that make the sequence honest rather than merely
 * present: it is authored only where it exists, the words come from the course,
 * the recognised and constructed answers are the pack's own, and every step is
 * answerable with the sound off.
 */

const AUTHORED = ['english-to-french', 'english-to-italian'];
const UNAUTHORED = ['english-to-german', 'english-to-spanish', 'english-to-portuguese'];

const steps = (slug: string): readonly FirstWinStep[] => firstWinFor(slug)!.steps;

/**
 * Comments are stripped before the "forbidden shape" checks so a file stays free
 * to explain the rule it is being held to — the same rule `tests/course-banners.test.ts`
 * follows, and the reason this file can name a microphone it must not use.
 */
const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '');

describe('first-win sequences exist where they are claimed', () => {
  it.each(AUTHORED)('%s has a five-step sequence', (slug) => {
    const firstWin = firstWinFor(slug);
    expect(firstWin).not.toBeNull();
    // Four practice steps plus the recap: short by construction, and pinned so
    // the sequence cannot quietly grow into a lesson.
    expect(firstWinStepCount(slug)).toBe(5);
    expect(steps(slug).map((step) => step.phase)).toEqual([
      'meet',
      'recognize',
      'construct',
      'say',
    ]);
  });

  it.each(UNAUTHORED)('%s has none, and the flow therefore skips it', (slug) => {
    expect(firstWinFor(slug)).toBeNull();
    expect(hasFirstWin(slug)).toBe(false);
  });

  it('follows the roadmap order: hear it, recognise it, build it, say it', () => {
    for (const slug of AUTHORED) {
      const phases = steps(slug).map((step) => step.phase);
      expect(phases).toEqual(['meet', 'recognize', 'construct', 'say']);
    }
  });

  it('gives every sequence a recap that admits it is not a lesson', () => {
    for (const slug of AUTHORED) {
      const recap = firstWinFor(slug)!.recap;
      expect(recap.headline.length).toBeGreaterThan(0);
      expect(recap.notALesson).toMatch(/not lesson 1/i);
      expect(recap.notALesson).toMatch(/counts as finished/i);
    }
  });
});

describe('the answers are the course’s own words', () => {
  it.each(AUTHORED)('%s recognises the phrase the sequence just introduced', (slug) => {
    const meet = steps(slug).find((step) => step.phase === 'meet');
    const recognize = steps(slug).find((step) => step.phase === 'recognize');
    if (meet?.phase !== 'meet' || recognize?.phase !== 'recognize')
      throw new Error('expected a meet and a recognize step');
    // The recognition step asks about the phrase one step earlier, and its answer
    // is one of the meanings that phrase was just given — otherwise it would be
    // asking the learner to recall something they have never been told.
    expect(recognize.options).toContain(recognize.answer);
    expect(recognize.options).toHaveLength(3);
    const words = (text: string): string[] =>
      text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    const answerWords = words(recognize.answer);
    const meaningWords = new Set(words(meet.meaning));
    for (const word of answerWords)
      expect(
        meaningWords.has(word),
        `${slug}: recognition answer ${JSON.stringify(recognize.answer)} is not a meaning of ${JSON.stringify(meet.phrase)} (${JSON.stringify(meet.meaning)})`,
      ).toBe(true);
  });

  it.each(AUTHORED)('%s builds the phrase its own recording says', (slug) => {
    const meet = steps(slug).find((step) => step.phase === 'meet');
    const construct = steps(slug).find((step) => step.phase === 'construct');
    if (meet?.phase !== 'meet' || construct?.phase !== 'construct')
      throw new Error('expected a meet and a construct step');
    // The clip the learner just heard and the sentence they then build are the
    // same words, which is what makes the step feel earned rather than arbitrary.
    expect(construct.answer).toBe(meet.audioTranscript);
  });

  it.each(AUTHORED)('%s offers exactly one distractor in the build step', (slug) => {
    const construct = steps(slug).find((step) => step.phase === 'construct');
    if (construct?.phase !== 'construct') throw new Error('expected a construct step');
    expect(construct.tokens).toHaveLength(3);
    // The answer is built from two of the three tokens, in the order the
    // recording uses; the third is a real choice, not decoration.
    const answerTokens = construct.answer.split(' ');
    expect(answerTokens).toHaveLength(2);
    for (const token of answerTokens) expect(construct.tokens).toContain(token);
    const leftovers = construct.tokens.filter((token) => !answerTokens.includes(token));
    expect(leftovers).toHaveLength(1);
    expect(leftovers[0].replace(/\.$/, '')).not.toBe(answerTokens[0].replace(/,$/, ''));
  });

  it.each(AUTHORED)('%s reuses the course’s own model recording', (slug) => {
    const meet = steps(slug).find((step) => step.phase === 'meet');
    if (meet?.phase !== 'meet') throw new Error('expected a meet step');
    // A pack asset, not new audio: nothing here needs a native-speaker pass of
    // its own, and the welcome cannot drift from the course's pronunciation.
    expect(meet.audioUrl).toMatch(/^\/audio\/(french|italian)-foundations\/[a-z-]+\.wav$/);
    const language = slug.replace('english-to-', '');
    expect(meet.audioUrl).toContain(`${language}-foundations`);
  });
});

describe('every step works with the sound off', () => {
  it.each(AUTHORED)('%s can be finished without playing anything', (slug) => {
    // No step's content depends on hearing it: the recognised word and the
    // built sentence are both written out on screen, and the transcript of the
    // clip is available as text.
    for (const step of steps(slug)) {
      if (step.phase === 'meet') {
        expect(step.audioTranscript.length).toBeGreaterThan(0);
        expect(step.note).toMatch(/transcript/i);
      }
      if (step.phase === 'recognize') expect(step.options).toContain(step.answer);
      if (step.phase === 'construct') expect(step.answer.length).toBeGreaterThan(0);
      if (step.phase === 'say') expect(step.phrase.length).toBeGreaterThan(0);
    }
  });

  it('never touches a microphone or an audio requirement in code', () => {
    const source = withoutComments(
      readFileSync('src/components/onboarding/FirstWinFlow.tsx', 'utf8'),
    );
    expect(source).not.toMatch(/getUserMedia|MediaRecorder|microphone/i);
    // Nothing autoplays: the only play call is inside a click handler.
    expect(source).not.toMatch(/autoPlay/);
  });

  it('cannot write practice: the sequence imports no store', () => {
    const source = withoutComments(
      readFileSync('src/components/onboarding/FirstWinFlow.tsx', 'utf8'),
    );
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports.some((path) => path.includes('course-pack'))).toBe(false);
    expect(source).not.toMatch(/practice|attempt|evidence|lessonPractice/i);
  });
});

describe('the referenced recordings exist', () => {
  it.each(AUTHORED)('%s points at a file that ships', (slug) => {
    const meet = steps(slug).find((step) => step.phase === 'meet');
    if (meet?.phase !== 'meet') throw new Error('expected a meet step');
    const onDisk = `public${meet.audioUrl}`;
    const bytes = readFileSync(onDisk);
    // A real recording, not a placeholder: the four pack model clips are 70-90KB.
    expect(bytes.byteLength).toBeGreaterThan(20000);
  });
});
