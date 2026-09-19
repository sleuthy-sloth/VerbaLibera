import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { normalizePack } from '@/features/course-pack/normalize-pack';
import { validateV2Pack } from '@/features/course-pack/schema-v2';
import { buildCourseOutcomes } from '../scripts/content/outcomes';
import { readProseReview } from '../scripts/content/review';

/**
 * Phase 4's first bounded slice: two more authored German foundation lessons.
 *
 * The expansion is additive on purpose. Every existing lesson, activity, stimulus,
 * concept, unit and vocabulary entry is byte-identical to what shipped before it —
 * the diff is the new records and nothing else — so a learner's history, the
 * review that already happened, and the replay of stored practice are all
 * untouched. What these cases hold is that claim, plus the two things a course
 * can quietly get wrong when it grows: an unreachable exercise, and a review
 * record that covers text nobody has read.
 */

const ROOT = process.cwd();
const raw = JSON.parse(
  readFileSync(path.join(ROOT, 'courses', 'german', 'manifest.json'), 'utf8'),
) as Record<string, unknown>;
const pack = normalizePack(raw);

/** The two lessons this slice added, in the order they were appended. */
const ADDED = ['de-weather-foundation', 'de-free-time-foundation'] as const;
/** The lesson the first addition follows, and which the second follows behind it. */
const PREVIOUS_LESSON = 'de-family-people-foundation';

const v1LessonOf = (lessonId: string) =>
  pack.lessons.find((lesson) => lesson.id === lessonId)!.legacyExercises;

describe('the German foundation expansion', () => {
  it('is a valid v2 pack with the two new lessons appended', () => {
    expect(() => validateV2Pack(raw)).not.toThrow();
    expect(raw.schemaVersion).toBe(2);
    expect(pack.lessons.map((lesson) => lesson.id)).toEqual([
      'de-first-words-foundation',
      'de-introductions-foundation',
      'de-cafe-requests-foundation',
      'de-numbers-quantities-foundation',
      'de-directions-foundation',
      'de-shopping-foundation',
      'de-time-days-foundation',
      PREVIOUS_LESSON,
      ...ADDED,
    ]);
  });

  it('keeps the course counts honest after the growth', () => {
    expect(pack.lessons).toHaveLength(10);
    expect(pack.units).toHaveLength(5);
    expect(pack.concepts).toHaveLength(10);
    expect(pack.vocabulary).toHaveLength(42);
    expect(pack.lessons.flatMap((lesson) => lesson.legacyExercises)).toHaveLength(62);
    // The pack's own description used to say "four A1 German lessons" while it
    // shipped eight; it now names what it carries, and the count is checked.
    expect(String(raw.description)).toMatch(/^Ten A1 German lessons/);
    expect(String(raw.version)).toBe('0.5.0');
  });

  it('chains the new lessons onto the course that was already there', () => {
    for (const [index, lessonId] of ADDED.entries()) {
      const lesson = pack.lessons.find((candidate) => candidate.id === lessonId)!;
      const expected = index === 0 ? PREVIOUS_LESSON : ADDED[0];
      expect(lesson.prerequisites.map((entry) => entry.lessonId), lessonId).toEqual([expected]);
      // The pack's authored convention: every lesson is A1 and carries a note.
      const authored = raw.lessons as Array<{ id: string; cefr?: string; culturalNote?: string }>;
      const source = authored.find((entry) => entry.id === lessonId)!;
      expect(source.cefr).toBe('A1');
      expect(source.culturalNote?.length ?? 0).toBeGreaterThan(40);
    }
    expect(pack.units.map((unit) => unit.id)).toEqual([
      'de-unit-1',
      'de-unit-2',
      'de-unit-3',
      'de-unit-4',
      'de-unit-5',
    ]);
  });

  it('reaches every exercise the new lessons authored, and completes on them', () => {
    for (const lessonId of ADDED) {
      const lesson = pack.lessons.find((candidate) => candidate.id === lessonId)!;
      const authored = v1LessonOf(lessonId).map((exercise) => exercise.id);
      expect(authored.length, `${lessonId} authored exercises`).toBeGreaterThanOrEqual(6);
      // The adapter turns each exercise into a step, behind the lesson's intro.
      const stepActivityIds = lesson.steps.map((step) => step.activityId);
      for (const exerciseId of authored) {
        expect(stepActivityIds, `${lessonId} reaches ${exerciseId}`).toContain(exerciseId);
        expect(pack.activities[exerciseId], `${exerciseId} is a real activity`).toBeDefined();
      }
      // Completion is the authored exercises, in order, and nothing else.
      expect(lesson.completionPolicy).toEqual({ kind: 'legacy-success', exerciseIds: authored });
      expect(lesson.legacyCompletionExerciseIds).toEqual(authored);
      // Every step's activity exists and no stimulus reference dangles.
      for (const step of lesson.steps) expect(pack.activities[step.activityId]).toBeDefined();
    }
  });

  it('authors no audio, so it claims none', () => {
    // The slice was written without new recordings. The honest consequence is
    // that neither new lesson contains a listening exercise, and the pack still
    // ships exactly the one model clip it had.
    expect(pack.media).toHaveLength(1);
    for (const lessonId of ADDED) {
      const kinds = v1LessonOf(lessonId).map((exercise) => exercise.kind);
      expect(kinds, lessonId).not.toContain('dictation');
      const hearing = pack.lessons
        .find((lesson) => lesson.id === lessonId)!
        .steps.map((step) => pack.activities[step.activityId])
        .filter((activity) => 'stimulusId' in activity && activity.stimulusId)
        .map((activity) => pack.stimuli[(activity as { stimulusId: string }).stimulusId]);
      for (const stimulus of hearing) {
        if (stimulus?.kind === 'audio') expect(pack.media.some((m) => m.id === stimulus.mediaId)).toBe(true);
      }
    }
    for (const lesson of pack.lessons) {
      for (const exercise of lesson.legacyExercises) {
        if (exercise.kind !== 'dictation') continue;
        expect(
          pack.media.some((asset) => asset.id === exercise.audioId),
          `${exercise.id} plays audio that exists`,
        ).toBe(true);
      }
    }
  });

  it('says in its own review record that the new lessons are unreviewed', () => {
    // The German prose passed native-speaker review on 2026-09-11, covering eight
    // lessons. These two were written afterwards, so the record has to say so —
    // and it has to name them, or the next reader cannot tell what is outstanding.
    const review = JSON.parse(
      readFileSync(path.join(ROOT, 'courses', 'german', 'review.json'), 'utf8'),
    ) as { nativeSpeaker: { status: string; reviewed?: string; pending?: string } };
    expect(review.nativeSpeaker.status).toBe('partial');
    expect(review.nativeSpeaker.reviewed).toMatch(/1-8/);
    expect(review.nativeSpeaker.pending).toMatch(/9-10/);
    for (const lessonId of ADDED) {
      const title = pack.lessons.find((lesson) => lesson.id === lessonId)!.title;
      expect(review.nativeSpeaker.pending, `${title} is named as pending`).toContain(title);
    }
    // And the pack's own attribution says the same thing, so a reader of the
    // manifest does not have to find the review file to know.
    expect(String(raw.attribution)).toMatch(/lessons 1-8 reviewed/);
    expect(String(raw.attribution)).toMatch(/lessons 9-10 pending/);
  });
});

/**
 * What lessons 9-10 will need before a say step can be added to them.
 *
 * Nothing here asserts German wording. The proposed sentences live in
 * `docs/superpowers/plans/2026-09-19-german-lessons-9-10-say-steps.md` and stay
 * unreviewed until a speaker reads them, so the fixtures below use placeholder
 * text and check the scaffolding instead: the schema accepts the shape, an
 * optional step cannot disturb completion or replay, the media contract holds,
 * and the report moves a unit out of `not-applicable` once speaking exists.
 */
describe('the scaffolding a German say step needs', () => {
  const SELF_COMPARE = {
    kind: 'self-compare',
    id: 'fixture-say',
    revision: 1,
    conceptIds: ['de-weather-concept'],
    vocabulary: ['de-weather-word-2'],
    skills: ['speaking'],
    // A placeholder on purpose: the reviewed sentence is not in any test.
    prompt: 'PLACEHOLDER PROMPT',
    modelText: 'PLACEHOLDER MODEL',
  };

  const withSayStep = (lessonId: string, activity: Record<string, unknown>, nextStepId: string | null) => {
    const fixture = JSON.parse(JSON.stringify(raw)) as {
      activities: Array<Record<string, unknown>>;
      lessons: Array<{ id: string; steps: Array<Record<string, unknown>> }>;
    };
    const lesson = fixture.lessons.find((entry) => entry.id === lessonId)!;
    fixture.activities.push(activity);
    // The step lands last, which is where an optional say step is cheapest: the
    // step before it keeps pointing at the read step and only its own link moves.
    lesson.steps.push({
      id: `${lessonId}-step-say`,
      purpose: 'practice',
      activityId: activity.id,
      required: false,
      nextStepId,
      branches: {},
    });
    return fixture;
  };

  it('accepts the proposed shape in the real pack, without the recording', () => {
    const fixture = withSayStep('de-weather-foundation', { ...SELF_COMPARE }, null);
    expect(() => validateV2Pack(fixture)).not.toThrow();
    // modelAudioId is optional, so the activity can land before the audio does —
    // the model text still gives the learner something to compare against.
    expect('modelAudioId' in SELF_COMPARE).toBe(false);
    const withAudio = withSayStep('de-weather-foundation', { ...SELF_COMPARE, modelAudioId: 'de-first-words-foundation-model' }, null);
    expect(() => validateV2Pack(withAudio)).not.toThrow();
  });

  it('cannot disturb completion, because completion is the authored exercises', () => {
    // This is why the say step is safe to add to a lesson that already ships: the
    // lesson's completion policy names legacy exercises, and a new optional step
    // is not one of them, so neither an attempt nor a skip can change the count.
    const lesson = pack.lessons.find((candidate) => candidate.id === 'de-weather-foundation')!;
    expect(lesson.completionPolicy).toEqual({
      kind: 'legacy-success',
      exerciseIds: lesson.legacyCompletionExerciseIds,
    });
    const policy = lesson.completionPolicy;
    if (policy.kind !== 'legacy-success') throw new Error('German completion is legacy-success');
    expect(policy.exerciseIds).not.toContain(SELF_COMPARE.id);
    // And the shipped lesson proves the same thing: its intro step is not graded.
    const intro = lesson.steps.find((step) => step.id === 'de-weather-foundation-step-intro')!;
    expect(policy.exerciseIds).not.toContain(intro.activityId);
    // The fixture's own say step is optional, so it cannot be part of a policy
    // that only names required authored work.
    const fixture = withSayStep('de-weather-foundation', { ...SELF_COMPARE }, null);
    const addedStep = fixture.lessons
      .find((entry) => entry.id === 'de-weather-foundation')!
      .steps.at(-1)!;
    expect(addedStep.required).toBe(false);
  });

  it('holds the media contract a self-compare recording has to satisfy', () => {
    // Asserted on Italian, which already ships say steps, so the rule is proven
    // against real data and German inherits it the moment its clip lands.
    const italian = normalizePack(
      JSON.parse(readFileSync(path.join(ROOT, 'courses', 'italian', 'manifest.json'), 'utf8')),
    );
    const says = italian.lessons
      .flatMap((lesson) => lesson.steps.map((step) => italian.activities[step.activityId]))
      .filter((activity) => activity?.kind === 'self-compare');
    expect(says.length).toBeGreaterThan(0);
    for (const activity of says) {
      const modelAudioId = (activity as { modelAudioId?: string }).modelAudioId;
      if (!modelAudioId) continue;
      const asset = italian.media.find((entry) => entry.id === modelAudioId);
      expect(asset, `${modelAudioId} is declared`).toBeDefined();
      expect(asset!.url.startsWith('/audio/')).toBe(true);
      expect(asset!.sha256).toMatch(/^[0-9a-f]{64}$/);
      // Offline is a precache rule, not a second copy: /audio/** is in the worker.
      const worker = readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
      expect(worker).toContain('/audio/');
    }
  });

  it('moves a unit out of not-applicable the moment speaking exists', () => {
    // The report-state transition this change will cause, stated as a rule: the
    // contract answers `not-applicable` only while a course authors no speaking.
    const germanNow = buildCourseOutcomes(pack, readProseReview('german'));
    expect(
      germanNow.contracts.every(
        (contract) =>
          contract.items.find((entry) => entry.item === 'optional self-compare speaking')!.state ===
          'not-applicable',
      ),
    ).toBe(true);
    const italian = buildCourseOutcomes(
      normalizePack(JSON.parse(readFileSync(path.join(ROOT, 'courses', 'italian', 'manifest.json'), 'utf8'))),
      readProseReview('italian'),
    );
    const withSpeaking = italian.contracts.filter(
      (contract) =>
        contract.items.find((entry) => entry.item === 'optional self-compare speaking')!.state === 'present',
    );
    expect(withSpeaking.length).toBeGreaterThan(0);
    // Once German's two say steps land in de-unit-5, its first unit stays
    // not-applicable-by-absence of speaking only where it still authors none.
    expect(withSpeaking.every((contract) => contract.countsAsReviewed === false)).toBe(true);
  });
});
