import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MINUTES,
  selectNextAction,
  type FoundationProgress,
  type NextActionInput,
} from '@/features/progress/next-action';

/**
 * The decision order is the contract. Every case below is a learner the app can
 * actually produce, and the copy is pinned where it is preserved from the
 * behaviour this replaced — a first-visit guest must still be told to open the
 * course, with the same words the e2e suite already probes.
 */

const FRENCH = { packSlug: 'french', language: 'french', languageName: 'French' } as const;

const lesson = (over: Partial<FoundationProgress['nextLesson']> = {}) => ({
  id: 'fr-1',
  title: 'Meeting people',
  minutes: 8,
  position: 1,
  totalLessons: 25,
  ...over,
}) as NonNullable<FoundationProgress['nextLesson']>;

const foundation = (over: Partial<FoundationProgress> = {}): FoundationProgress => ({
  packId: 'fr-foundations',
  language: 'french',
  totalLessons: 25,
  completedLessonCount: 0,
  hasPractice: true,
  nextLesson: lesson(),
  unfinished: null,
  dueReviewCount: 0,
  dueTitles: [],
  ...over,
});

const input = (over: Partial<NextActionInput> = {}): NextActionInput => ({
  course: FRENCH,
  foundation: foundation(),
  guided: { hasSessionStep: false, isAuthoredCourse: true },
  dueReviewCount: 0,
  dailyGoal: { completed: 0, target: 5 },
  minutesAvailable: 10,
  ...over,
});

describe('selectNextAction', () => {
  it('asks a learner with no course to choose one', () => {
    expect(selectNextAction(input({ course: null })).reason).toBe('choose-course');
  });

  it('offers to finish the lesson left half-done, before anything else', () => {
    // Break caught: an unfinished session is ignored in favour of a due review or
    // the next lesson, and the learner's own half-finished work is never offered.
    const action = selectNextAction(
      input({
        foundation: foundation({
          completedLessonCount: 1,
          unfinished: { ...lesson({ id: 'fr-2', title: 'At the café', position: 2 }), stepIndex: 3, stepCount: 7 },
          dueReviewCount: 4,
          dueTitles: ['Ordering a coffee'],
        }),
        minutesAvailable: 8,
      }),
    );

    expect(action.reason).toBe('resume-lesson');
    expect(action.label).toBe('Finish At the café');
    expect(action.detail).toContain('3 of 7 steps');
    expect(action.href).toBe('/courses/french?start=1');
    expect(action.minutes).toBe(8);
    expect(action.optional).toBe(false);
  });

  it('bounds the review action by the learner time budget and names what is first', () => {
    const action = selectNextAction(
      input({
        foundation: foundation({ dueReviewCount: 11, dueTitles: ['Ordering a coffee', 'Greetings'] }),
        minutesAvailable: 8,
      }),
    );

    expect(action.reason).toBe('due-review');
    // 8 minutes ÷ 2 minutes per phrase = 4; the other 7 are not pretended away.
    expect(action.label).toBe('Review 4 phrases');
    expect(action.detail).toContain('11 are waiting');
    expect(action.detail).toContain('First up: Ordering a coffee');
    expect(action.minutes).toBe(8);
    expect(action.href).toBe('/courses/french?start=1');
  });

  it('does not overstate a review action that fits in the window', () => {
    const action = selectNextAction(
      input({ foundation: foundation({ dueReviewCount: 1, dueTitles: ['Greetings'] }), minutesAvailable: 15 }),
    );

    expect(action.label).toBe('Review 1 phrase');
    expect(action.detail).toContain('1 phrase you have already met');
    expect(action.detail).not.toContain('waiting');
  });

  it('moves on to the next lesson once nothing is due', () => {
    const action = selectNextAction(
      input({ foundation: foundation({ completedLessonCount: 4, nextLesson: lesson({ position: 5, title: 'At the market' }) }) }),
    );

    expect(action.reason).toBe('next-lesson');
    expect(action.label).toBe('Continue with At the market');
    expect(action.detail).toContain('Lesson 5 of 25');
  });

  it('says so plainly when the course is finished and nothing is due', () => {
    const action = selectNextAction(
      input({ foundation: foundation({ completedLessonCount: 25, nextLesson: null }) }),
    );

    expect(action.reason).toBe('all-done');
    expect(action.label).toBe('Nothing due today');
    expect(action.detail).toContain('all 25 lessons');
    expect(action.href).toBe('/courses/french?start=1');
  });

  it('keeps the previous decision, and its words, for a learner with no foundation practice', () => {
    // Break caught: the new engine changes what a first-visit guest is told.
    // The e2e suite probes these two labels by name.
    const guided = selectNextAction(
      input({ foundation: null, guided: { hasSessionStep: true, isAuthoredCourse: true } }),
    );
    expect(guided.label).toBe('Continue today\u2019s lesson');
    expect(guided.href).toBe('/learn/english-to-french');

    const opening = selectNextAction(input({ foundation: foundation({ hasPractice: false, nextLesson: null }) }));
    expect(opening.reason).toBe('start-course');
    expect(opening.label).toBe('Open French foundations');
    // `?start=1` is what the previous card linked to; the course cover is one
    // click further in and the learner already said they wanted to practise.
    expect(opening.href).toBe('/courses/french?start=1');
  });

  it('never sends a learner at a session their course does not have', () => {
    // Break caught: the snapshot's review queue is offered on a course that has
    // no composed session, producing a /learn/ link with nothing behind it.
    // German is the real example: a pack, a course page, and no travel-fixture
    // course, while the snapshot still reports due reviews.
    const GERMAN = { packSlug: 'german', language: 'german', languageName: 'German' } as const;
    const action = selectNextAction(
      input({
        course: GERMAN,
        foundation: null,
        guided: { hasSessionStep: false, isAuthoredCourse: false },
        dueReviewCount: 28,
      }),
    );

    expect(action.reason).toBe('start-course');
    expect(action.href).toBe('/courses/german?start=1');
    expect(action.href).not.toContain('/learn/');
  });

  it('offers the snapshot queue on the course it belongs to', () => {
    const action = selectNextAction(
      input({
        foundation: null,
        guided: { hasSessionStep: false, isAuthoredCourse: true },
        dueReviewCount: 9,
        minutesAvailable: 5,
      }),
    );

    expect(action.reason).toBe('due-review');
    expect(action.label).toBe('Review 2 phrases');
    expect(action.href).toBe('/learn/english-to-french');
  });

  it('still points a learner at their course when nothing at all is due', () => {
    // The card used to render a status line here ("lessons are being authored")
    // with nothing to click. Opening the course is always a way forward.
    const action = selectNextAction(
      input({ foundation: null, guided: { hasSessionStep: false, isAuthoredCourse: false }, dueReviewCount: 0 }),
    );

    expect(action.reason).toBe('start-course');
    expect(action.href).toBe('/courses/french?start=1');
  });

  it('prefers local foundation evidence over the snapshot session', () => {
    // Both signals present: the course the learner is actually in wins.
    const action = selectNextAction(
      input({ foundation: foundation({ dueReviewCount: 2, dueTitles: ['Greetings'] }), guided: { hasSessionStep: true, isAuthoredCourse: true }, dueReviewCount: 5 }),
    );

    expect(action.reason).toBe('due-review');
    expect(action.href).toBe('/courses/french?start=1');
  });

  it('offers the action instead of withholding it once today goal is met', () => {
    const action = selectNextAction(
      input({
        foundation: foundation({ completedLessonCount: 4, nextLesson: lesson({ position: 5, title: 'At the market' }) }),
        dailyGoal: { completed: 5, target: 5 },
      }),
    );

    expect(action.reason).toBe('next-lesson');
    expect(action.optional).toBe(true);
    expect(action.detail).toContain("already done today's 5 steps");
    expect(action.href).not.toBeNull();
  });

  it('falls back to a usable budget when the learner has not set one', () => {
    for (const minutesAvailable of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const action = selectNextAction(
        input({ foundation: foundation({ dueReviewCount: 9, dueTitles: ['Greetings'] }), minutesAvailable }),
      );
      // Nine are due, so the default ten-minute budget — not the queue — decides
      // how many fit: one phrase every two minutes.
      expect(action.label).toBe(`Review ${DEFAULT_MINUTES / 2} phrases`);
      expect(action.minutes).toBe(DEFAULT_MINUTES);
    }
  });

  it('always returns one action, and the same one for the same history', () => {
    const stale = input({
      foundation: foundation({ completedLessonCount: 2, dueReviewCount: 3, dueTitles: ['Greetings'] }),
      minutesAvailable: 15,
      dailyGoal: { completed: 0, target: 5 },
    });

    expect(selectNextAction(stale)).toEqual(selectNextAction(stale));
  });
});
