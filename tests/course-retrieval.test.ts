import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { RuntimePack } from '@/features/course-pack/lesson-runtime';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import { buildCourseOutcomes } from '../scripts/content/outcomes';
import { readProseReview } from '../scripts/content/review';

/**
 * Retrieval: what a course brings back after it has moved on.
 *
 * The finding this file exists to hold is uncomfortable and easy to lose sight
 * of: as of the French retrieval plan, no lesson in any of the five courses
 * brings back a single word from an earlier one. Every course is a chain of
 * introductions, and the unit contract says so — every unit but the last reports
 * its retrieval item `absent`.
 *
 * Two things are pinned here rather than asserted in prose: the current state, so
 * a course that changes it has to come back and say so, and the exact mechanism
 * the plan depends on, so nobody plans retrieval that the report cannot see.
 */

const LANGUAGES = ['french', 'german', 'italian', 'portuguese', 'spanish'] as const;
const ROOT = process.cwd();

const rawOf = (language: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'courses', language, 'manifest.json'), 'utf8'));

const packOf = (language: string): RuntimePack => normalizePack(rawOf(language));
const courseOf = (language: string) => buildCourseOutcomes(packOf(language), readProseReview(language));

const itemOf = (course: ReturnType<typeof courseOf>, unitId: string, item: string) =>
  course.contracts
    .find((contract) => contract.unitId === unitId)!
    .items.find((entry) => entry.item === item)!;

const RETRIEVAL = 'introduced and later-retrieved vocabulary and patterns';

/**
 * A copy of a lesson that already validates, with the parts that must be unique
 * stripped or renamed. The point of these fixtures is the lesson's declared
 * vocabulary and concepts, so steps are replaced with one harmless step.
 */
const fixtureLesson = (
  template: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> => {
  const stepId = `${String(overrides.id)}-step`;
  const templateSteps = template.steps as Array<{ id: string; activityId: string }>;
  const entry = templateSteps.find((step) => step.id === template.entryStepId) ?? templateSteps[0]!;
  return {
    ...JSON.parse(JSON.stringify(template)),
    legacyExercises: [],
    legacyCompletionExerciseIds: [],
    completionPolicy: { kind: 'participation' },
    steps: [
      {
        id: stepId,
        purpose: 'transfer',
        activityId: entry.activityId,
        required: false,
        nextStepId: null,
        branches: {},
      },
    ],
    entryStepId: stepId,
    ...overrides,
  };
};

describe('retrieval across the courses', () => {
  it.each(LANGUAGES)('%s brings nothing back yet, and this is where that shows', (language) => {
    const course = courseOf(language);
    // Not one lesson retrieves: the count is per lesson, so this is the whole
    // course, not a summary line.
    const retrieving = course.rows.filter((row) => row.retrievesVocabulary.length > 0);
    expect(retrieving, `${language} lessons that retrieve`).toHaveLength(0);

    const lastUnit = course.contracts.at(-1)!;
    for (const contract of course.contracts) {
      const item = itemOf(course, contract.unitId, RETRIEVAL);
      if (contract.unitId === lastUnit.unitId) {
        // Nothing follows the last unit, so the item is not-applicable, and its
        // basis still counts what that unit strands.
        expect(item.state, `${language}/${contract.unitId}`).toBe('not-applicable');
        expect(item.basis).toMatch(/introduces \d+ item\(s\) that nothing in this course brings back/);
      } else {
        expect(item.state, `${language}/${contract.unitId}`).toBe('absent');
        expect(item.basis, `${language}/${contract.unitId}`).toMatch(/^0 of \d+ item\(s\)/);
      }
    }
  });

  it('counts what it is about to lose, per unit, not just that it lost it', () => {
    // The basis has to carry the arithmetic, or a course cannot tell 1 stranded
    // item from 27 and cannot see partial progress when the plan starts landing.
    const course = courseOf('french');
    const unit1 = itemOf(course, 'fr-unit-1', RETRIEVAL);
    expect(unit1.basis).toMatch(/0 of 27 item\(s\) introduced here come back in a later lesson; 27 do not/);
    // 22 words and 5 concepts, read from the lessons' own lists.
    const unit1Rows = course.rows.filter((row) => row.unitId === 'fr-unit-1');
    const words = new Set(unit1Rows.flatMap((row) => row.introducesVocabulary));
    const concepts = new Set(unit1Rows.flatMap((row) => row.introducesConcepts));
    expect(words.size).toBe(22);
    expect(concepts.size).toBe(5);
  });

  it('credits retrieval from the lesson lists, and a later lesson flips the item', () => {
    // Non-vacuity, and the mechanism the French plan is built on: a lesson in a
    // later unit that lists an earlier unit's words and concepts makes that unit's
    // item present. If this stops being true, the plan needs rewriting, not the
    // report.
    const fixture = rawOf('french') as {
      lessons: Array<Record<string, unknown>>;
    };
    const course = courseOf('french');
    const unit1Words = [
      ...new Set(course.rows.filter((row) => row.unitId === 'fr-unit-1').flatMap((row) => row.introducesVocabulary)),
    ];
    const unit1Concepts = [
      ...new Set(course.rows.filter((row) => row.unitId === 'fr-unit-1').flatMap((row) => row.introducesConcepts)),
    ];

    // A lesson copied from one that already validates, moved into a later unit and
    // re-list only, so the fixture isolates the thing under test. Covering unit 1
    // takes three lessons because a lesson's vocabulary list holds at most ten ids
    // — a constraint the plan has to work inside, not around.
    const template = JSON.parse(JSON.stringify(fixture.lessons.at(-1)!)) as Record<string, unknown>;
    const chunks = [
      { words: unit1Words.slice(0, 8), concepts: unit1Concepts.slice(0, 2) },
      { words: unit1Words.slice(8, 16), concepts: unit1Concepts.slice(2, 4) },
      { words: unit1Words.slice(16), concepts: unit1Concepts.slice(4) },
    ];
    chunks.forEach((chunk, index) => {
      fixture.lessons.push(
        fixtureLesson(template, {
          id: `fixture-retrieval-lesson-${index + 1}`,
          unitId: 'fr-unit-2',
          vocabulary: chunk.words,
          conceptIds: chunk.concepts.length > 0 ? chunk.concepts : ['fr-home-concept'],
        }),
      );
    });

    const doctored = buildCourseOutcomes(normalizePack(fixture), readProseReview('french'));
    const flipped = itemOf(doctored, 'fr-unit-1', RETRIEVAL);
    expect(flipped.state).toBe('present');
    expect(flipped.basis).toMatch(/^27 of 27 item\(s\)/);
    expect(doctored.rows.at(-1)!.retrievesVocabulary).toHaveLength(6);
    const appended = doctored.rows.slice(-3);
    expect(appended.flatMap((row) => row.retrievesVocabulary)).toHaveLength(22);
    expect(appended.every((row) => row.introducesVocabulary.length === 0)).toBe(true);
    // The shipped pack is untouched by the fixture.
    expect(itemOf(course, 'fr-unit-1', RETRIEVAL).state).toBe('absent');
  });

  it('reads declarations, so a list entry with no step behind it would still count', () => {
    // The honest limitation of this check, written down as a test rather than
    // discovered later: retrieval is credited from the lesson's vocabulary and
    // concept lists, and nothing validates that a step in that lesson actually
    // uses those words. That is why the French plan pairs every list entry with a
    // step that exercises it, and why the basis says where the count comes from.
    const fixture = rawOf('french') as { lessons: Array<Record<string, unknown>> };
    const template = JSON.parse(JSON.stringify(fixture.lessons.at(-1)!)) as Record<string, unknown>;
    fixture.lessons.push(
      fixtureLesson(template, {
        id: 'fixture-declared-only',
        unitId: 'fr-unit-2',
        // Declared here, never touched by any step: the report credits it anyway.
        vocabulary: ['fr-first-words-word-1'],
        conceptIds: ['fr-first-words-concept'],
      }),
    );
    const doctored = buildCourseOutcomes(normalizePack(fixture), readProseReview('french'));
    const last = doctored.rows.at(-1)!;
    expect(last.retrievesVocabulary).toEqual(['fr-first-words-word-1']);
    // The fixture's single step points at an informational activity, so the lesson
    // has no practice mode at all — and the word is still credited. The count
    // reads declarations; it does not check that anything was practised.
    expect(last.modes).toHaveLength(0);
    // One word and one concept: two of the unit's 27 items, credited from a list
    // alone.
    expect(itemOf(doctored, 'fr-unit-1', RETRIEVAL).basis).toMatch(/^2 of 27 item\(s\)/);
  });
});
