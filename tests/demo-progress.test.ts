import { composeDailySession } from '@/features/session/compose-session';
import { initialCourses } from '@/features/curriculum/fixture';
import { blankDemoProgress, demoProgress } from '@/features/progress/demo-progress';

const DAILY_GOAL_TARGET = 5;
const XP_PER_COMPLETED_CONCEPT = 20;
const XP_PER_SESSION_STEP = 20;

function deriveDemoCourses() {
  return initialCourses.map((course, index) => {
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

function deriveDemoSession() {
  return initialCourses.flatMap((course) => {
    const concepts = course.concepts;
    const dueReviews = concepts.slice(1, 2).map((c) => ({ id: `${c.id}-review-1`, contentId: c.id }));
    const drillRounds = concepts.slice(1, 3).map((c) => ({ id: `${c.id}-drill-1`, contentId: c.id, drillId: `${c.id}-drill` }));
    const pictureRounds = concepts.slice(1, 2).flatMap((c) =>
      c.drills
        .filter((d) => d.kind === 'PICTURE_CHOICE')
        .map((d) => ({ id: `${d.id}-1`, contentId: c.id, drillId: d.id })),
    );
    const newPattern = concepts[0] ? { id: `${concepts[0].id}-1`, contentId: concepts[0].id } : null;
    return composeDailySession({
      courseSlug: course.slug,
      dueReviews,
      drillRounds: [...drillRounds, ...pictureRounds],
      newPattern,
      maxSteps: 5,
    });
  });
}

function deriveXp(courses: ReturnType<typeof deriveDemoCourses>, session: ReturnType<typeof deriveDemoSession>) {
  const completedConcepts = courses.reduce((sum, course) => {
    const total = initialCourses.find((c) => c.slug === course.slug)?.concepts.length ?? 5;
    const completed = Math.round((course.completionPercent / 100) * total);
    return sum + completed;
  }, 0);
  return completedConcepts * XP_PER_COMPLETED_CONCEPT + session.length * XP_PER_SESSION_STEP;
}

function deriveDueCount(session: ReturnType<typeof deriveDemoSession>) {
  return session.filter((s) => s.kind === 'REVIEW' || s.kind === 'DRILL').length;
}

function deriveFlow(courses: ReturnType<typeof deriveDemoCourses>) {
  const maxPercent = Math.max(...courses.map((c) => c.completionPercent), 0);
  return Math.floor(maxPercent / 20);
}

describe('demo progress snapshot', () => {
  it('exposes the selected learner progress and a session derived from the daily policy', () => {
    // Break caught: dashboard data drifting from the deterministic daily-session policy.
    expect(demoProgress).toMatchObject({
      selectedCourseSlug: 'english-to-french',
      xp: 600,
      practiceFlowDays: 4,
      dailyGoal: { completed: 5, target: 5 },
      dueReviewCount: 16,
    });
    expect(demoProgress.session.filter((step) => step.courseSlug === 'english-to-french')).toEqual([
      { id: 'fr-ordering-politely-review-1', kind: 'REVIEW', courseSlug: 'english-to-french', contentId: 'fr-ordering-politely' },
      { id: 'fr-ordering-politely-drill-1', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'fr-ordering-politely', drillId: 'fr-ordering-politely-drill' },
      { id: 'fr-find-place-drill-1', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'fr-find-place', drillId: 'fr-find-place-drill' },
      { id: 'fr-ordering-politely-picture-1', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'fr-ordering-politely', drillId: 'fr-ordering-politely-picture' },
      { id: 'fr-greet-politely-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-french', contentId: 'fr-greet-politely' },
    ]);
    expect(demoProgress.session.filter((step) => step.courseSlug === 'english-to-italian')).toEqual([
      { id: 'it-ordering-politely-review-1', kind: 'REVIEW', courseSlug: 'english-to-italian', contentId: 'it-ordering-politely' },
      { id: 'it-ordering-politely-drill-1', kind: 'DRILL', courseSlug: 'english-to-italian', contentId: 'it-ordering-politely', drillId: 'it-ordering-politely-drill' },
      { id: 'it-find-place-drill-1', kind: 'DRILL', courseSlug: 'english-to-italian', contentId: 'it-find-place', drillId: 'it-find-place-drill' },
      { id: 'it-ordering-politely-picture-1', kind: 'DRILL', courseSlug: 'english-to-italian', contentId: 'it-ordering-politely', drillId: 'it-ordering-politely-picture' },
      { id: 'it-greet-politely-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-italian', contentId: 'it-greet-politely' },
    ]);
    expect(new Set(demoProgress.session.map((step) => step.id)).size).toBe(demoProgress.session.length);
  });
});

describe('demo progress derived math (Task 13 alive seed)', () => {
  it('derives xp/flow/due/dailyGoal/courses/session from initialCourses + composeSession, not hardcoded constants', () => {
    const expectedCourses = deriveDemoCourses();
    const expectedSession = deriveDemoSession();
    const expectedDue = deriveDueCount(expectedSession);
    const expectedFlow = deriveFlow(expectedCourses);
    const expectedXp = deriveXp(expectedCourses, expectedSession);
    const expectedSelectedSlug = initialCourses[0]?.slug ?? 'english-to-french';
    const expectedDailyGoal = {
      completed: Math.min(
        expectedSession.filter((s) => s.courseSlug === expectedSelectedSlug).length,
        DAILY_GOAL_TARGET,
      ),
      target: DAILY_GOAL_TARGET,
    };
    expect(demoProgress.session).toEqual(expectedSession);
    expect(demoProgress.courses).toEqual(expectedCourses);
    expect(demoProgress.selectedCourseSlug).toBe(expectedSelectedSlug);
    expect(demoProgress.xp).toBe(expectedXp);
    expect(demoProgress.practiceFlowDays).toBe(expectedFlow);
    expect(demoProgress.dueReviewCount).toBe(expectedDue);
    expect(demoProgress.dailyGoal).toEqual(expectedDailyGoal);
    expect(blankDemoProgress.courses.map((c) => c.slug)).toEqual(initialCourses.map((c) => c.slug));
    expect(blankDemoProgress.courses.every((c) => c.completionPercent === 0)).toBe(true);
    expect(blankDemoProgress.session).toEqual([]);
    for (const step of demoProgress.session) {
      const course = initialCourses.find((c) => c.slug === step.courseSlug);
      expect(course?.concepts.some((concept) => concept.id === step.contentId)).toBe(true);
    }
  });

  it('has no hardcoded xp/flow/due literals drifting from derived math', () => {
    const expectedCourses = deriveDemoCourses();
    const expectedSession = deriveDemoSession();
    expect(demoProgress.xp).toBe(deriveXp(expectedCourses, expectedSession));
    expect(demoProgress.dueReviewCount).toBe(deriveDueCount(expectedSession));
    expect(demoProgress.practiceFlowDays).toBe(deriveFlow(expectedCourses));
  });
});
