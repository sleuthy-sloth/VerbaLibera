/**
 * The dashboard's next action: one decision, from every progress signal the app
 * already has.
 *
 * Before this, the Today card answered three different questions with one
 * ternary (`hasGuidedSession ? "Continue today's lesson" : foundationHref ?
 * "Open French foundations" : "being authored"`). The first branch reads the
 * snapshot's guided session, which is composed from the travel fixture — so a
 * learner twenty phrases into an Italian foundation course was told to open the
 * course from the top, and a learner with 11 foundation phrases due for review
 * saw "caught up".
 *
 * This module is pure: no storage, no clock, no network. Everything it knows
 * arrives in `NextActionInput`, which is what makes the decision order below
 * testable and what keeps it identical online, offline and in a test.
 *
 * ## Decision order
 *
 * ```
 * no course                                → choose-course
 * foundation practice exists on this device:
 *     a saved draft                        → resume-lesson
 *     evidence due                         → due-review
 *     an open lesson                       → next-lesson
 *     nothing open                         → all-done
 * no foundation practice:
 *     a guided session step                → next-lesson   (unchanged copy)
 *     reviews due, on the authored course  → due-review
 *     a course to open                     → start-course  (unchanged copy)
 * ```
 *
 * Local foundation evidence outranks the snapshot because it is the only
 * signal that describes the course the learner is actually in. Where it is
 * absent the previous branches and their copy are preserved verbatim, so a
 * first-visit guest sees exactly what they saw before.
 *
 * The one branch that reads the *snapshot's* queue is gated on the selected
 * course being the authored one. Without that gate, selecting German — a real
 * course with a real pack and no travel-fixture session — produced a
 * `/learn/english-to-german` link to a session that was never composed, which is
 * the dead link the dashboard test above this module already guards.
 */

export type NextActionReason =
  | 'choose-course'
  | 'resume-lesson'
  | 'due-review'
  | 'next-lesson'
  | 'start-course'
  | 'all-done';

export type NextAction = Readonly<{
  reason: NextActionReason;
  /** The one control's words. */
  label: string;
  /** Why this and not something else, in the learner's language. */
  detail: string;
  /** Always somewhere to go: an action with no way forward is a status message. */
  href: string;
  /** Honest estimate, bounded by the learner's own time budget. */
  minutes: number;
  /** True when today's steps are already done: offered, never owed. */
  optional: boolean;
}>;

export type FoundationLessonRef = Readonly<{
  id: string;
  title: string;
  minutes: number;
  /** 1-based position in the pack, for "lesson 3 of 25". */
  position: number;
  totalLessons: number;
}>;

export type FoundationProgress = Readonly<{
  packId: string;
  /** Pack slug: `french`, `italian`. */
  language: string;
  totalLessons: number;
  completedLessonCount: number;
  /**
   * Whether this device holds any foundation practice at all. False means the
   * dashboard knows nothing the snapshot does not already say.
   */
  hasPractice: boolean;
  /** The first lesson the learner may open and has not finished. */
  nextLesson: FoundationLessonRef | null;
  /** A saved draft: started, unfinished. */
  unfinished:
    | (FoundationLessonRef & Readonly<{ stepIndex: number; stepCount: number }>)
    | null;
  /** Evidence keys whose scheduled review is due now. */
  dueReviewCount: number;
  /** Concepts behind the due evidence, most urgent first. Never rendered as a score. */
  dueTitles: readonly string[];
}>;

export type NextActionCourse = Readonly<{
  /** Pack slug, the canonical identity (`french`). */
  packSlug: string;
  language: string;
  /** `French` — used in the copy, never re-derived from the slug at render time. */
  languageName: string;
}>;

export type NextActionInput = Readonly<{
  course: NextActionCourse | null;
  foundation: FoundationProgress | null;
  /**
   * The guided (travel) session the snapshot composed, if it has a step.
   *
   * `isAuthoredCourse` is not the same question: a course can have a due queue
   * and no step left, and a course with neither (German) must never be handed a
   * `/learn/...` link to a session that does not exist for it.
   */
  guided: Readonly<{ hasSessionStep: boolean; isAuthoredCourse: boolean }>;
  /** The snapshot's due queue: v1 review rows, or the fixture's preview drills. */
  dueReviewCount: number;
  dailyGoal: Readonly<{ completed: number; target: number }>;
  /**
   * The learner's own budget — their study plan's `minutesPerDay`, else
   * `DEFAULT_MINUTES`. It bounds the review action; it never removes one.
   */
  minutesAvailable: number;
}>;

/** When the learner has not said how long they have. */
export const DEFAULT_MINUTES = 10;

/** One review is one phrase: the estimate the review action divides the window by. */
const MINUTES_PER_REVIEW = 2;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const plural = (count: number, one: string, many: string) =>
  count === 1 ? one : many;

/** "You have done today's 5 steps — this one is extra." */
function optionalSuffix(input: NextActionInput): string {
  const { completed, target } = input.dailyGoal;
  if (target <= 0 || completed < target) return '';
  return ` You have already done today's ${target} ${plural(target, 'step', 'steps')} — this one is extra.`;
}

function budget(minutesAvailable: number): number {
  return Number.isFinite(minutesAvailable) && minutesAvailable > 0
    ? Math.floor(minutesAvailable)
    : DEFAULT_MINUTES;
}

function lessonCopy(lesson: FoundationLessonRef): string {
  return `Lesson ${lesson.position} of ${lesson.totalLessons} · about ${lesson.minutes} min`;
}

function decide(input: NextActionInput): NextAction {
  const { course, foundation } = input;
  const minutesAvailable = budget(input.minutesAvailable);
  const optional = optionalSuffix(input);

  if (!course) {
    return {
      reason: 'choose-course',
      label: 'Choose a course',
      detail: 'Pick a language and the first lesson takes about five minutes.',
      href: '/courses',
      minutes: 5,
      optional: false,
    };
  }

  if (foundation && foundation.hasPractice) {
    const language = foundation.language || course.language;
    const courseHref = `/courses/${language}?start=1`;

    if (foundation.unfinished) {
      const lesson = foundation.unfinished;
      return {
        reason: 'resume-lesson',
        label: `Finish ${lesson.title}`,
        detail: `You are ${lesson.stepIndex} of ${lesson.stepCount} steps into this one. About ${Math.min(minutesAvailable, lesson.minutes)} min.${optional}`,
        href: courseHref,
        minutes: Math.min(minutesAvailable, lesson.minutes),
        optional: optional !== '',
      };
    }

    if (foundation.dueReviewCount > 0) {
      const take = clamp(Math.floor(minutesAvailable / MINUTES_PER_REVIEW), 1, foundation.dueReviewCount);
      const waiting = foundation.dueReviewCount;
      const first = foundation.dueTitles[0];
      const share = waiting > take
        ? `${waiting} are waiting; this is today's share.`
        : `${waiting} ${plural(waiting, 'phrase', 'phrases')} you have already met, ready for another look.`;
      return {
        reason: 'due-review',
        label: `Review ${take} ${plural(take, 'phrase', 'phrases')}`,
        detail: `${share}${first ? ` First up: ${first}.` : ''}${optional}`,
        href: courseHref,
        minutes: Math.min(minutesAvailable, take * MINUTES_PER_REVIEW),
        optional: optional !== '',
      };
    }

    if (foundation.nextLesson) {
      const lesson = foundation.nextLesson;
      return {
        reason: 'next-lesson',
        label: `Continue with ${lesson.title}`,
        detail: `${lessonCopy(lesson)}.${optional}`,
        href: courseHref,
        minutes: Math.min(minutesAvailable, lesson.minutes),
        optional: optional !== '',
      };
    }

    return {
      reason: 'all-done',
      label: 'Nothing due today',
      detail: `You have finished all ${foundation.totalLessons} ${plural(foundation.totalLessons, 'lesson', 'lessons')} in this course, and nothing is waiting for review. Revisit any lesson whenever you like.${optional}`,
      href: courseHref,
      minutes: 0,
      optional: optional !== '',
    };
  }

  if (input.guided.hasSessionStep) {
    return {
      reason: 'next-lesson',
      label: 'Continue today\u2019s lesson',
      detail: `Your next practice step is ready. About ${Math.min(minutesAvailable, 8)} min.${optional}`,
      href: `/learn/english-to-${course.packSlug}`,
      minutes: Math.min(minutesAvailable, 8),
      optional: optional !== '',
    };
  }

  // The snapshot's queue belongs to the authored course. Offering it while the
  // learner is looking at a different one would send them at a session that was
  // never composed for it — the dead link this card used to have.
  if (input.dueReviewCount > 0 && input.guided.isAuthoredCourse) {
    const take = clamp(Math.floor(minutesAvailable / MINUTES_PER_REVIEW), 1, input.dueReviewCount);
    const waiting = input.dueReviewCount;
    return {
      reason: 'due-review',
      label: `Review ${take} ${plural(take, 'phrase', 'phrases')}`,
      detail:
        waiting > take
          ? `${waiting} are waiting; this is today's share. About ${Math.min(minutesAvailable, take * MINUTES_PER_REVIEW)} min.${optional}`
          : `${waiting} ${plural(waiting, 'phrase', 'phrases')} are ready for another look. About ${Math.min(minutesAvailable, take * MINUTES_PER_REVIEW)} min.${optional}`,
      href: `/learn/english-to-${course.packSlug}`,
      minutes: Math.min(minutesAvailable, take * MINUTES_PER_REVIEW),
      optional: optional !== '',
    };
  }

  // Anything left with a course in hand opens that course. This is the branch
  // the card had before this module existed, and it stays reachable when the
  // device holds no readable practice: a learner is never handed a status line
  // with nothing to click.
  return {
    reason: 'start-course',
    label: `Open ${course.languageName} foundations`,
    detail: `The first lesson takes about ${Math.min(minutesAvailable, 5)} min.${optional}`,
    // `?start=1` opens the first lesson rather than the course cover: the
    // learner asked to practise, not to read a catalogue entry.
    href: `/courses/${course.language}?start=1`,
    minutes: Math.min(minutesAvailable, 5),
    optional: optional !== '',
  };
}

/** The one next action for the course the learner is looking at. */
export function selectNextAction(input: NextActionInput): NextAction {
  return decide(input);
}
