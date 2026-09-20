import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { normalizePack } from '@/features/course-pack/normalize-pack';
import { validateV2Pack } from '@/features/course-pack/schema-v2';
import { buildCourseOutcomes } from '../scripts/content/outcomes';
import { readProseReview } from '../scripts/content/review';

/**
 * The French retrieval plan, made executable.
 *
 * `docs/superpowers/plans/2026-09-19-french-retrieval-plan.md` proposes six
 * transfer steps to bring Unit 1 back. Writing it found two things by hand and
 * this file checks them mechanically instead, on the real pack, before any
 * content is authored:
 *
 * - the arithmetic: the six steps cover 24 of Unit 1's 27 items and strand exactly
 *   the three the plan names, and two lessons land on the ten-word list cap
 *   exactly, so a seventh step for those lessons is not available;
 * - the authoring contract: a graded activity has to declare that the model reveal
 *   affects its evidence, and the step has to be spliced into the lesson's chain
 *   rather than appended, or the pack will not normalize.
 *
 * No learner-visible wording is asserted: the sentences live in the plan and in
 * no test until a French speaker has read them. The fixtures below carry the
 * vocabulary and concept ids the plan assigns, which is what the report reads.
 */

const ROOT = process.cwd();
const LESSONS = ['fr-home-foundation', 'fr-descriptions-foundation', 'fr-plural-foundation', 'fr-routine-foundation'] as const;
const RETRIEVAL = 'introduced and later-retrieved vocabulary and patterns';

type Step = {
  activityId: string;
  stepId: string;
  lessonId: string;
  kind: 'cloze' | 'text';
  vocabulary: string[];
  conceptIds: string[];
  /** Sentence count is the editorial detail; the fixture only needs it to be text. */
  answer: string;
};

/** The plan's six steps, with the ids each one brings back. */
const PLAN: readonly Step[] = [
  {
    activityId: 'fr-home-have-retrieval',
    stepId: 'fr-home-foundation-step-have-retrieval',
    lessonId: 'fr-home-foundation',
    kind: 'cloze',
    vocabulary: ['fr-family-word-1', 'fr-people-word-3', 'fr-people-word-4'],
    conceptIds: ['fr-family-concept', 'fr-people-concept'],
    answer: "J'ai une maison. Elle est à la maison.",
  },
  {
    activityId: 'fr-home-family-retrieval',
    stepId: 'fr-home-foundation-step-family-retrieval',
    lessonId: 'fr-home-foundation',
    kind: 'cloze',
    vocabulary: ['fr-family-word-4', 'fr-family-word-2', 'fr-family-word-3'],
    conceptIds: ['fr-family-concept'],
    answer: "J'ai une sœur. Tu as un frère.",
  },
  {
    activityId: 'fr-describe-me-retrieval',
    stepId: 'fr-descriptions-foundation-step-me-retrieval',
    lessonId: 'fr-descriptions-foundation',
    kind: 'cloze',
    vocabulary: ['fr-identity-word-1', 'fr-identity-word-2', 'fr-identity-word-3', 'fr-numbers-word-1', 'fr-numbers-word-3'],
    conceptIds: ['fr-identity-concept', 'fr-numbers-concept'],
    answer: "Je suis française. J'ai vingt ans.",
  },
  {
    activityId: 'fr-plural-friend-retrieval',
    stepId: 'fr-plural-foundation-step-friend-retrieval',
    lessonId: 'fr-plural-foundation',
    kind: 'cloze',
    vocabulary: ['fr-people-word-1', 'fr-people-word-2', 'fr-family-word-2', 'fr-identity-word-3', 'fr-numbers-word-2', 'fr-numbers-word-3'],
    conceptIds: ['fr-numbers-concept', 'fr-people-concept'],
    answer: 'Tu es française. Tu as trente ans.',
  },
  {
    activityId: 'fr-routine-greet-retrieval',
    stepId: 'fr-routine-foundation-step-greet-retrieval',
    lessonId: 'fr-routine-foundation',
    kind: 'cloze',
    vocabulary: ['fr-first-words-word-1', 'fr-identity-word-4'],
    conceptIds: ['fr-first-words-concept'],
    answer: 'Bonjour, je suis française.',
  },
  {
    activityId: 'fr-routine-counter-retrieval',
    stepId: 'fr-routine-foundation-step-counter-retrieval',
    lessonId: 'fr-routine-foundation',
    kind: 'text',
    vocabulary: ['fr-first-words-word-3', 'fr-first-words-word-2', 'fr-first-words-word-4'],
    conceptIds: ['fr-first-words-concept'],
    answer: 'Oui, merci. Non, merci.',
  },
];

/** The three items the plan defers, named by id so the ledger cannot drift. */
const DEFERRED = ['fr-first-words-word-5', 'fr-first-words-word-6', 'fr-numbers-word-4'] as const;

type RawPack = {
  activities: Array<Record<string, unknown>>;
  lessons: Array<{
    id: string;
    steps: Array<Record<string, unknown>>;
    vocabulary: string[];
    conceptIds: string[];
  }>;
};

const rawFrench = (): RawPack =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'courses', 'french', 'manifest.json'), 'utf8')) as RawPack;

/** Apply the plan to the pack in memory. `omitAssistance` is the non-vacuity hook. */
function applyPlan(raw: RawPack, options: { omitAssistance?: boolean } = {}): RawPack {
  for (const step of PLAN) {
    const lesson = raw.lessons.find((entry) => entry.id === step.lessonId)!;
    raw.activities.push({
      kind: step.kind,
      id: step.activityId,
      revision: 1,
      conceptIds: step.conceptIds,
      vocabulary: step.vocabulary,
      skills: ['writing', 'grammar'],
      prompt: `FIXTURE ${step.activityId}`,
      feedback: 'FIXTURE feedback.',
      evidenceKey: step.activityId,
      ...(options.omitAssistance ? {} : { assistanceAffectsEvidence: ['hint', 'model'] }),
      ...(step.kind === 'text'
        ? { answer: { answers: [step.answer], allowTypo: true, errors: [] } }
        : {
            segments: [
              { kind: 'text', text: 'FIXTURE' },
              { kind: 'blank', name: 'b1', label: 'Missing word' },
            ],
            blanks: { b1: { answers: ['FIXTURE'], allowTypo: true, errors: [] } },
          }),
    });
    lesson.vocabulary = [...lesson.vocabulary, ...step.vocabulary];
    lesson.conceptIds = [...new Set([...lesson.conceptIds, ...step.conceptIds])];
    // Splice in before the lesson's last step (its reading step) and rewire exactly
    // one link: the step that used to point at the reading step now points here.
    const at = lesson.steps.length - 1;
    const previous = lesson.steps[at - 1]!;
    const following = lesson.steps[at]!;
    lesson.steps.splice(at, 0, {
      id: step.stepId,
      purpose: 'transfer',
      activityId: step.activityId,
      required: true,
      nextStepId: following.id,
      branches: {},
    });
    previous.nextStepId = step.stepId;
  }
  return raw;
}

const itemOf = (course: ReturnType<typeof buildCourseOutcomes>, unitId: string) =>
  course.contracts
    .find((contract) => contract.unitId === unitId)!
    .items.find((entry) => entry.item === RETRIEVAL)!;

const courseOf = (raw: RawPack) => buildCourseOutcomes(normalizePack(raw), readProseReview('french'));

describe('the French retrieval plan', () => {
  it('validates and normalizes as written, with no new legacy records', () => {
    const raw = applyPlan(rawFrench());
    expect(() => validateV2Pack(raw)).not.toThrow();
    expect(() => normalizePack(raw)).not.toThrow();
  });

  it('covers 24 of Unit 1\'s 27 items, stranding exactly the three it names', () => {
    const course = courseOf(applyPlan(rawFrench()));
    const item = itemOf(course, 'fr-unit-1');
    // The plan's headline number, checked against the pack rather than trusted.
    expect(item.basis).toMatch(/^24 of 27 item\(s\)/);
    expect(item.state).toBe('absent');

    const before = course.rows.filter((row) => row.unitId === 'fr-unit-1');
    const introduced = before.flatMap((row) => [...row.introducesVocabulary, ...row.introducesConcepts]);
    const retrievedLater = new Set(
      course.rows
        .slice(course.rows.findIndex((row) => row.unitId === 'fr-unit-1') + before.length)
        .flatMap((row) => [...row.retrievesVocabulary, ...row.retrievesConcepts]),
    );
    const stranded = [...new Set(introduced)].filter((id) => !retrievedLater.has(id)).sort();
    expect(stranded).toEqual([...DEFERRED].sort());
  });

  it('leaves two lessons exactly on the ten-word cap, so nothing else fits there', () => {
    const raw = applyPlan(rawFrench());
    const counts = LESSONS.map((id) => {
      const lesson = raw.lessons.find((entry) => entry.id === id)!;
      return { id, words: lesson.vocabulary.length, concepts: lesson.conceptIds.length };
    });
    for (const entry of counts) {
      expect(entry.words, `${entry.id} words`).toBeLessThanOrEqual(10);
      expect(entry.concepts, `${entry.id} concepts`).toBeLessThanOrEqual(5);
    }
    // The tight ones: a seventh item for either lesson would break the pack.
    expect(counts.filter((entry) => entry.words === 10).map((entry) => entry.id).sort()).toEqual([
      'fr-home-foundation',
      'fr-plural-foundation',
    ]);
  });

  it('needs the model-reveal declaration, which is why the plan states it per step', () => {
    // Non-vacuity for the authoring contract this package found: schema validation
    // passes without it and normalization does not.
    const raw = applyPlan(rawFrench(), { omitAssistance: true });
    expect(() => validateV2Pack(raw)).not.toThrow();
    expect(() => normalizePack(raw)).toThrow(/model reveal must affect evidence/);
  });

  it('splices one link per affected lesson and leaves every existing id alone', () => {
    const plain = rawFrench();
    const before = {
      lessons: plain.lessons.map((lesson) => lesson.id),
      steps: plain.lessons.flatMap((lesson) => lesson.steps.map((step) => step.id as string)),
    };
    const raw = applyPlan(rawFrench());
    expect(raw.lessons.map((lesson) => lesson.id)).toEqual(before.lessons);
    const after = raw.lessons.flatMap((lesson) => lesson.steps.map((step) => step.id as string));
    for (const id of before.steps) expect(after).toContain(id);
    // Six new steps, and no existing step removed.
    expect(after.length).toBe(before.steps.length + PLAN.length);

    for (const lessonId of LESSONS) {
      const original = plain.lessons.find((entry) => entry.id === lessonId)!;
      const updated = raw.lessons.find((entry) => entry.id === lessonId)!;

      // Exactly one pre-existing step in the lesson moved its link: the one that
      // used to point at the reading step. The rest of the chain is untouched.
      const originalById = new Map(original.steps.map((step) => [String(step.id), step]));
      const moved = updated.steps.filter((step) => {
        const previous = originalById.get(String(step.id));
        return previous !== undefined && previous.nextStepId !== step.nextStepId;
      });
      expect(moved.map((step) => String(step.id)), `${lessonId} moved links`).toHaveLength(1);

      // And the lesson still walks: every step, the new ones included, is reachable
      // from the entry step. This is what fails if a step is appended instead.
      const byId = new Map(updated.steps.map((step) => [String(step.id), step]));
      const entry = String((updated as { entryStepId?: string }).entryStepId);
      const seen = new Set<string>();
      let cursor: string | null = entry;
      while (cursor !== null && !seen.has(cursor)) {
        seen.add(cursor);
        const next: unknown = byId.get(cursor)?.nextStepId;
        cursor = typeof next === 'string' ? next : null;
      }
      expect(seen.size, `${lessonId} chain reachable from its entry step`).toBe(updated.steps.length);
    }
  });
});
