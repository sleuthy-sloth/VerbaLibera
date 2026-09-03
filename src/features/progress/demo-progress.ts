import { initialCourses } from '@/features/curriculum/fixture';
import { composeDailySession } from '@/features/session/compose-session';
import type { DemoProgressSnapshot } from './types';

// Tunable fiction math — keeps preview honest while derived from fixtures
const DAILY_GOAL_TARGET = 5;
const XP_PER_COMPLETED_CONCEPT = 20;
const XP_PER_SESSION_STEP = 20;
const FLOW_DAYS_DIVISOR = 20;

function deriveCourses(): DemoProgressSnapshot['courses'] {
  return initialCourses.map((course, index) => {
    // Fiction: first course near-complete (4/5), second just started (1/5) — varied but derived
    const fictionCompleted = index === 0 ? course.concepts.length - 1 : 1;
    const completionPercent = Math.round((fictionCompleted / course.concepts.length) * 100);
    return {
      slug: course.slug,
      title: course.title,
      unitLabel: `Unit 1: ${course.concepts[0]?.scenario ?? 'Patterns'}`,
      completionPercent,
    };
  });
}

function deriveSession() {
  return initialCourses.flatMap((course) => {
    const concepts = course.concepts;
    // Derive session inputs from fixture concepts — no hardcoded contentIds
    const dueReviews = concepts.slice(1, 2).map((c) => ({ id: `${c.id}-review-1`, contentId: c.id }));
    const drillRounds = concepts.slice(1, 3).map((c) => ({ id: `${c.id}-drill-1`, contentId: c.id, drillId: `${c.id}-drill` }));
    // Picture-choice vocab drills ride along with their concept's text drill.
    // The demo path surfaces pictures for the in-focus concepts (slice 1,3).
    const pictureRounds = concepts.slice(1, 3).flatMap((c) =>
      c.drills
        .filter((d) => d.kind === 'PICTURE_CHOICE')
        .map((d) => ({ id: `${d.id}-1`, contentId: c.id, drillId: d.id })),
    );
    // The ordering anchor concept gets the full multimodal treatment: listen
    // (ear) + builder (word order) join its text + picture drills.
    const anchorRounds = concepts.slice(1, 2).flatMap((c) =>
      c.drills
        .filter((d) => d.kind === 'LISTEN_TYPE' || d.kind === 'WORD_ORDER')
        .map((d) => ({ id: `${d.id}-1`, contentId: c.id, drillId: d.id })),
    );
    const newPattern = concepts[0] ? { id: `${concepts[0].id}-1`, contentId: concepts[0].id } : null;
    return composeDailySession({
      courseSlug: course.slug,
      dueReviews,
      drillRounds: [...drillRounds, ...pictureRounds, ...anchorRounds],
      newPattern,
      maxSteps: 8,
    });
  });
}

function deriveBlankCourses(): DemoProgressSnapshot['courses'] {
  return initialCourses.map((course) => ({
    slug: course.slug,
    title: course.title,
    unitLabel: `Unit 1: ${course.concepts[0]?.scenario ?? 'Patterns'}`,
    completionPercent: 0,
  }));
}

const derivedCourses = deriveCourses();
const derivedSession = deriveSession();
const derivedBlankCourses = deriveBlankCourses();

const selectedCourseSlug = initialCourses[0]?.slug ?? 'english-to-french';

const dueReviewCount = derivedSession.filter((s) => s.kind === 'REVIEW' || s.kind === 'DRILL').length;
const maxCompletion = Math.max(...derivedCourses.map((c) => c.completionPercent), 0);
const practiceFlowDays = Math.floor(maxCompletion / FLOW_DAYS_DIVISOR);
const completedConcepts = derivedCourses.reduce((sum, course) => {
  const total = initialCourses.find((c) => c.slug === course.slug)?.concepts.length ?? 5;
  const completed = Math.round((course.completionPercent / 100) * total);
  return sum + completed;
}, 0);
const xp = completedConcepts * XP_PER_COMPLETED_CONCEPT + derivedSession.length * XP_PER_SESSION_STEP;
const dailyGoal = {
  completed: Math.min(
    derivedSession.filter((s) => s.courseSlug === selectedCourseSlug).length,
    DAILY_GOAL_TARGET,
  ),
  target: DAILY_GOAL_TARGET,
} as const;

export const blankDemoProgress: DemoProgressSnapshot = {
  selectedCourseSlug,
  xp: 0,
  practiceFlowDays: 0,
  dailyGoal: { completed: 0, target: DAILY_GOAL_TARGET },
  dueReviewCount: 0,
  snapshotAt: new Date(0).toISOString(),
  courses: derivedBlankCourses,
  session: [],
  contentVersion: null,
};

export const demoProgress: DemoProgressSnapshot = {
  selectedCourseSlug,
  xp,
  practiceFlowDays,
  dailyGoal,
  dueReviewCount,
  snapshotAt: new Date(0).toISOString(),
  courses: derivedCourses,
  session: derivedSession,
  contentVersion: null,
};
