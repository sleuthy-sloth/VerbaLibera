import { describe, expect, it } from 'vitest';
import { buildFoundationProgress, lessonEligible } from '@/features/progress/foundation-progress';
import { evaluateActivity } from '@/features/course-pack/activity-evaluation';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import { projectLessonEvidence } from '@/features/course-pack/attempts';
import type {
  ActivityAttempt,
  LearningEvent,
  LessonCheckpoint,
  StepCompletion,
} from '@/features/course-pack/attempts';
import type { Response, RuntimePack } from '@/features/course-pack/lesson-runtime';
import { makePilotPack } from './fixtures/lesson-variety';

/**
 * The engine's foundation input, assembled from the same projection the course
 * shell gates lessons with. The events here are built from the authored pilot
 * pack and completed through the real evaluator, so "lesson 1 is complete" means
 * the projection walked its required steps and agreed.
 */

const AT = '2026-09-08T10:00:00.000Z';
const DAY = 86_400_000;
const pack = (): RuntimePack => normalizePack(makePilotPack());
const at = (offsetDays = 0) => new Date(new Date(AT).getTime() + offsetDays * DAY);

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

function attempt(target: RuntimePack, lessonId: string, stepId: string, activityId: string, response: Response): ActivityAttempt {
  const activity = target.activities[activityId];
  const lesson = target.lessons.find((candidate) => candidate.id === lessonId)!;
  return {
    eventVersion: 2,
    type: 'attempt',
    id: nextId('att'),
    packId: target.id,
    packVersion: target.version,
    lessonId,
    lessonRevision: lesson.revision,
    stepId,
    activityId,
    activityRevision: activity.revision,
    evidenceKey: 'evidenceKey' in activity ? activity.evidenceKey : undefined,
    response,
    assistance: [],
    evaluation: evaluateActivity(activity, response, []),
    at: AT,
  };
}

function completion(target: RuntimePack, event: ActivityAttempt, stepId: string): StepCompletion {
  return {
    eventVersion: 2,
    type: 'step-completed',
    id: nextId('cmp'),
    packId: target.id,
    packVersion: target.version,
    lessonId: event.lessonId,
    lessonRevision: event.lessonRevision,
    stepId,
    attemptId: event.id,
    at: AT,
  };
}

/** Walk lesson 1 the way a learner does: four steps, three of them graded. */
function completeFirstLesson(target: RuntimePack, options: Readonly<{ dropFinalStep?: boolean }> = {}): LearningEvent[] {
  const info: StepCompletion = {
    eventVersion: 2,
    type: 'step-completed',
    id: nextId('cmp'),
    packId: target.id,
    packVersion: target.version,
    lessonId: 'it-cafe-story',
    lessonRevision: 1,
    stepId: 'st-s1',
    at: AT,
  };
  const evidence = attempt(target, 'it-cafe-story', 'st-s2', 'act-story-evidence', { kind: 'selection', ids: ['un-caffe'] });
  const sequence = attempt(target, 'it-cafe-story', 'st-s3', 'act-story-sequence', {
    kind: 'ordering',
    ids: ['t-saluta', 't-ordina', 't-ringrazia'],
  });
  const events: LearningEvent[] = [
    info,
    evidence,
    completion(target, evidence, 'st-s2'),
    sequence,
    completion(target, sequence, 'st-s3'),
  ];
  if (options.dropFinalStep) return events;
  const produced = attempt(target, 'it-cafe-story', 'st-s4', 'it-cafe-order-text', {
    kind: 'text',
    text: 'Un caffè, per favore.',
  });
  return [...events, produced, completion(target, produced, 'st-s4')];
}

const checkpoint = (over: Partial<LessonCheckpoint> = {}): LessonCheckpoint => ({
  packId: 'it-variety-pilot',
  lessonId: 'it-cafe-conversation',
  revision: 1,
  stepId: 'cv-s3',
  selectedBranches: { 'cv-s2': 'r-formal' },
  assistance: [],
  draft: null,
  at: AT,
  ...over,
});

describe('buildFoundationProgress', () => {
  it('describes a learner who has not started as having nothing', () => {
    const target = pack();
    const progress = buildFoundationProgress(target, 'italian', [], [], at(1));

    expect(progress.hasPractice).toBe(false);
    expect(progress.completedLessonCount).toBe(0);
    expect(progress.unfinished).toBeNull();
    expect(progress.dueReviewCount).toBe(0);
    expect(progress.dueTitles).toEqual([]);
    // The first open lesson is still the right next action, even with no history.
    expect(progress.nextLesson).toMatchObject({ id: 'it-cafe-story', position: 1, totalLessons: 3 });
  });

  it('moves the next lesson on once one is genuinely finished', () => {
    const target = pack();
    const progress = buildFoundationProgress(target, 'italian', completeFirstLesson(target), [], at(1));

    expect(progress.hasPractice).toBe(true);
    expect(progress.completedLessonCount).toBe(1);
    expect(progress.nextLesson).toMatchObject({ id: 'it-cafe-conversation', title: 'Al bar con il barista', position: 2 });
  });

  it('will not advance past a lesson whose own evidence is still missing', () => {
    // Same walk, minus the final produced line: the lesson does not complete and
    // the next one stays locked — the dashboard must not offer it.
    const target = pack();
    const events = completeFirstLesson(target, { dropFinalStep: true });
    const progress = buildFoundationProgress(target, 'italian', events, [], at(1));

    expect(progress.completedLessonCount).toBe(0);
    expect(progress.nextLesson).toMatchObject({ id: 'it-cafe-story' });
    expect(progress.dueReviewCount).toBe(2);
  });

  it('offers the draft the learner left behind, and only while it still resumes', () => {
    const target = pack();
    const events = completeFirstLesson(target);
    const resumable = buildFoundationProgress(target, 'italian', events, [checkpoint()], at(1));
    const stale = buildFoundationProgress(target, 'italian', events, [checkpoint({ revision: 2 })], at(1));
    const forAnotherCourse = buildFoundationProgress(target, 'italian', events, [checkpoint({ packId: 'es-foundations' })], at(1));
    const forAFinishedLesson = buildFoundationProgress(
      target,
      'italian',
      events,
      [checkpoint({ lessonId: 'it-cafe-story', stepId: 'st-s3' })],
      at(1),
    );

    expect(resumable.unfinished).toMatchObject({
      id: 'it-cafe-conversation',
      title: 'Al bar con il barista',
      stepIndex: 3,
      stepCount: 5,
    });
    expect(resumable.hasPractice).toBe(true);
    // A lesson that has been re-authored cannot resume, so "finish this" would be
    // a lie; a draft for another pack is not this course's business either.
    expect(stale.unfinished).toBeNull();
    expect(forAnotherCourse.unfinished).toBeNull();
    expect(forAFinishedLesson.unfinished).toBeNull();
  });

  it('keeps a draft-only learner on the card instead of losing the session', () => {
    const target = pack();
    const progress = buildFoundationProgress(target, 'italian', [], [checkpoint()], at(1));

    expect(progress.hasPractice).toBe(true);
    expect(progress.unfinished?.id).toBe('it-cafe-conversation');
    expect(progress.completedLessonCount).toBe(0);
  });

  it('counts what is due and names the concepts behind it', () => {
    const target = pack();
    const events = completeFirstLesson(target);
    const fresh = buildFoundationProgress(target, 'italian', events, [], at(0));
    const later = buildFoundationProgress(target, 'italian', events, [], at(3));

    expect(fresh.dueReviewCount).toBe(0);
    expect(later.dueReviewCount).toBe(3);
    expect(later.dueTitles).toHaveLength(3);
    expect(new Set(later.dueTitles)).toEqual(new Set(['Ordinare un caffè']));
  });

  it('reports no practice when every event is quarantined', () => {
    // History the projection refuses to act on is not progress, and the card
    // falls back to the snapshot rather than claiming an empty course.
    const target = pack();
    const forged = { ...attempt(target, 'it-cafe-story', 'st-s2', 'act-story-evidence', { kind: 'selection', ids: ['un-caffe'] }), evidenceKey: 'ev-wrong' };
    const progress = buildFoundationProgress(target, 'italian', [forged], [], at(1));

    expect(progress.hasPractice).toBe(false);
    expect(progress.nextLesson).toMatchObject({ id: 'it-cafe-story' });
  });

  it('uses the same eligibility rule the course shell opens lessons with', () => {
    const target = pack();
    const empty = projectLessonEvidence(target, []);
    const afterFirst = projectLessonEvidence(target, completeFirstLesson(target));
    const [story, conversation, listening] = target.lessons;

    expect(lessonEligible(target, story, empty)).toBe(true);
    expect(lessonEligible(target, conversation, empty)).toBe(false);
    expect(lessonEligible(target, listening, empty)).toBe(false);
    expect(lessonEligible(target, conversation, afterFirst)).toBe(true);
    expect(lessonEligible(target, listening, afterFirst)).toBe(false);
  });
});
