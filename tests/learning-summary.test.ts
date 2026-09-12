import { describe, expect, it } from 'vitest';
import {
  modalityForSkills,
  summarizeLearning,
  type LearningSummary,
} from '@/features/progress/learning-summary';
import { evaluateActivity } from '@/features/course-pack/activity-evaluation';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import type { ActivityAttempt, LearningEvent } from '@/features/course-pack/attempts';
import type { Assistance, Response, RuntimePack, Skill } from '@/features/course-pack/lesson-runtime';
import { makePilotPack } from './fixtures/lesson-variety';

/**
 * The summary is computed over the authored pilot pack, not a stub: the counts
 * are real numbers from real lessons, and the projection validates every event,
 * so a miscounted figure here is a real one.
 *
 * Every attempt is built by running the pack's own evaluator, which is also what
 * `projectLessonEvidence` re-runs to decide whether to trust it. Hand-written
 * expectations would prove nothing.
 */

const AT = '2026-09-08T10:00:00.000Z';
const DAY = 86_400_000;
const pack = (): RuntimePack => normalizePack(makePilotPack());
const at = (offsetDays = 0) => new Date(new Date(AT).getTime() + offsetDays * DAY);

let counter = 0;

function attempt(
  target: RuntimePack,
  where: { lessonId: string; stepId: string; activityId: string },
  response: Response,
  assistance: Assistance[] = [],
): ActivityAttempt {
  const activity = target.activities[where.activityId];
  const lesson = target.lessons.find((candidate) => candidate.id === where.lessonId)!;
  counter += 1;
  return {
    eventVersion: 2,
    type: 'attempt',
    id: `att-${counter}`,
    packId: target.id,
    packVersion: target.version,
    lessonId: where.lessonId,
    lessonRevision: lesson.revision,
    stepId: where.stepId,
    activityId: where.activityId,
    activityRevision: activity.revision,
    evidenceKey: 'evidenceKey' in activity ? activity.evidenceKey : undefined,
    response,
    assistance,
    evaluation: evaluateActivity(activity, response, assistance),
    at: AT,
  };
}

const storyEvidence = (target: RuntimePack, correct = true) =>
  attempt(
    target,
    { lessonId: 'it-cafe-story', stepId: 'st-s2', activityId: 'act-story-evidence' },
    { kind: 'selection', ids: [correct ? 'un-caffe' : 'un-te'] },
  );
const orderText = (target: RuntimePack) =>
  attempt(
    target,
    { lessonId: 'it-cafe-story', stepId: 'st-s4', activityId: 'it-cafe-order-text' },
    { kind: 'text', text: 'Un caffè, per favore.' },
  );
const listenGist = (target: RuntimePack) =>
  attempt(
    target,
    { lessonId: 'it-cafe-listening', stepId: 'li-s2', activityId: 'act-listen-gist' },
    { kind: 'selection', ids: ['g-coffee'] },
  );
const selfCompare = (target: RuntimePack, rating: 'again' | 'comfortable' = 'comfortable') =>
  attempt(
    target,
    { lessonId: 'it-cafe-listening', stepId: 'li-s6', activityId: 'act-listen-self' },
    { kind: 'self', rating },
  );

const numbers = (summary: LearningSummary) => ({
  phrases: summary.phrasesPractised,
  situations: summary.situationsAttempted,
  recognition: summary.recognition,
  production: summary.production,
  listening: summary.listening,
  selfChecks: summary.selfAssessment.checks,
});

describe('summarizeLearning', () => {
  it('reports an empty history as empty, not as progress', () => {
    const target = pack();
    const summary = summarizeLearning(target, [], at(2));

    expect(summary.phrasesPractised).toBe(0);
    expect(summary.situationsAttempted).toBe(0);
    expect(summary.revisit).toEqual([]);
    expect(summary.selfAssessment).toEqual({ checks: 0, comfortable: 0, again: 0 });
    // The denominator is real: this is the pilot pack's own lesson count.
    expect(summary.situationsTotal).toBe(target.lessons.length);
    expect(summary.situationsTotal).toBe(3);
  });

  it('counts the phrases practised across the lessons, and nothing else', () => {
    const target = pack();
    const summary = summarizeLearning(target, [storyEvidence(target), orderText(target), listenGist(target)], at(0));

    expect(summary.phrasesPractised).toBe(3);
    expect(summary.situationsAttempted).toBe(2);
    expect(summary.recognition).toEqual({ independent: 1, assisted: 0 });
    expect(summary.production).toEqual({ independent: 1, assisted: 0 });
    expect(summary.listening).toEqual({ independent: 1, assisted: 0 });
    expect(summary.selfAssessment.checks).toBe(0);
  });

  it('keeps a self-assessment out of every other figure', () => {
    // Break caught: a self-rating on a spoken line is folded into retrieval, and
    // the learner is told they reproduced something nobody heard.
    const target = pack();
    const before = summarizeLearning(target, [storyEvidence(target), orderText(target), listenGist(target)], at(0));
    const after = summarizeLearning(
      target,
      [storyEvidence(target), orderText(target), listenGist(target), selfCompare(target)],
      at(0),
    );

    expect(after.selfAssessment).toEqual({ checks: 1, comfortable: 1, again: 0 });
    expect(numbers(after)).toEqual({ ...numbers(before), selfChecks: 1 });
    expect(after.selfAssessment.checks).toBe(1);
    expect(after.production.independent).toBe(before.production.independent);
    expect(after.phrasesPractised).toBe(before.phrasesPractised);
  });

  it('separates a self-assessment the learner rated hard from one they rated comfortable', () => {
    const summary = summarizeLearning(pack(), [selfCompare(pack(), 'again'), selfCompare(pack(), 'comfortable')], at(0));

    expect(summary.selfAssessment).toEqual({ checks: 2, comfortable: 1, again: 1 });
  });

  it('counts an assisted answer as practice, never as independent evidence', () => {
    const target = pack();
    const summary = summarizeLearning(
      target,
      [attempt(target, { lessonId: 'it-cafe-story', stepId: 'st-s2', activityId: 'act-story-evidence' }, { kind: 'selection', ids: ['un-caffe'] }, ['model'])],
      at(0),
    );

    expect(summary.recognition).toEqual({ independent: 0, assisted: 1 });
    expect(summary.phrasesPractised).toBe(0);
    expect(summary.situationsAttempted).toBe(1);
  });

  it('names what to revisit, due first and shaky after', () => {
    const target = pack();
    const events: LearningEvent[] = [storyEvidence(target), orderText(target)];
    // The story answer comes due a day later; the order answer was missed and is
    // not due yet, so it is shaky rather than due.
    const summary = summarizeLearning(target, [events[1], { ...storyEvidence(target, false), id: 'att-miss' }], at(0));
    const later = summarizeLearning(target, events, at(2));

    expect(summary.revisit.map((item) => item.state)).toEqual(['shaky']);
    expect(summary.revisit[0].label).toBe('Ordinare un caffè');
    expect(summary.revisit[0].lessonId).toBe('it-cafe-story');
    expect(later.revisit.map((item) => item.state)).toEqual(['due', 'due']);
    expect(later.revisit.map((item) => item.label)).toEqual(['Ordinare un caffè', 'Ordinare un caffè']);
  });

  it('ignores an event the projection refuses to trust', () => {
    // An attempt claiming a different target than its activity carries is
    // quarantined, so it must not become practice.
    const target = pack();
    const forged = { ...orderText(target), evidenceKey: 'ev-something-else' };
    const summary = summarizeLearning(target, [forged], at(2));

    expect(summary.phrasesPractised).toBe(0);
    expect(summary.situationsAttempted).toBe(0);
    expect(summary.production).toEqual({ independent: 0, assisted: 0 });
  });

  it('buckets skills for a learner the same way, except for speaking', () => {
    // The learner-facing bucket is its own decision: the scheduler folds a
    // spoken line in with recognition because it has no answer to grade, and a
    // learner who said it out loud is producing language.
    expect(modalityForSkills(['listening', 'grammar'] satisfies Skill[])).toBe('listening');
    expect(modalityForSkills(['writing'])).toBe('production');
    expect(modalityForSkills(['reading', 'vocabulary'])).toBe('recognition');
    expect(modalityForSkills(['speaking'])).toBe('production');
  });
});
