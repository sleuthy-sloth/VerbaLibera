import {
  projectLessonEvidence,
  type LearningEvent,
  type LessonCheckpoint,
} from '@/features/course-pack/attempts';
import type { RuntimePack, RuntimeLesson } from '@/features/course-pack/lesson-runtime';
import { evidenceHomesFor } from './learning-summary';
import type { FoundationLessonRef, FoundationProgress } from './next-action';

/**
 * The foundation course's own progress, in the shape the next-action engine
 * asks about.
 *
 * The projection already answers all of it — `projectLessonEvidence` returns
 * which lessons are complete, which evidence is due, and which events never
 * counted — but it answers it about a *pack*, while the engine needs it about
 * the *learner*: which lesson is open, what they left half-done, whether
 * anything at all has happened here.
 *
 * Two decisions are worth naming:
 *
 * - **Eligibility is the course shell's rule, copied deliberately.**
 *   `RuntimeCourseWorkspace` opens the first lesson whose prerequisites the
 *   projection satisfies. If the dashboard picked a different lesson the two
 *   surfaces would disagree about "next", and the dashboard would be the one
 *   that is wrong, because the shell is where the learner lands. The rule lives
 *   here once; the shell still has its own inline copy from before this slice.
 * - **A draft only counts if it is still resumable.** A checkpoint records the
 *   lesson revision it was written against; a lesson that has been re-authored
 *   since cannot resume (`resumeSession` restarts instead), so offering it as
 *   "finish this" would send the learner to a lesson that ignores the draft.
 */

const lessonRef = (pack: RuntimePack, lesson: RuntimeLesson): FoundationLessonRef => ({
  id: lesson.id,
  title: lesson.title,
  minutes: lesson.estimatedMinutes,
  position: pack.lessons.findIndex((candidate) => candidate.id === lesson.id) + 1,
  totalLessons: pack.lessons.length,
});

/** The shell's prerequisite rule: every stated requirement is satisfied. */
export function lessonEligible(
  pack: RuntimePack,
  lesson: RuntimeLesson,
  evidence: ReturnType<typeof projectLessonEvidence>,
): boolean {
  return lesson.prerequisites.every((prerequisite) => {
    if (evidence.legacyCredits.includes(prerequisite.lessonId)) return true;
    if (prerequisite.requirement.kind === 'participation')
      return evidence.participationCompleted.includes(prerequisite.lessonId);
    if (prerequisite.requirement.kind === 'legacy-success')
      return evidence.legacyCredits.includes(prerequisite.lessonId);
    return (
      (evidence.evidence[prerequisite.requirement.evidenceKey]?.successes ?? 0) >=
      prerequisite.requirement.successes
    );
  });
}

export function buildFoundationProgress(
  pack: RuntimePack,
  language: string,
  events: readonly LearningEvent[],
  checkpoints: readonly LessonCheckpoint[],
  now: Date,
): FoundationProgress {
  const projected = projectLessonEvidence(pack, [...events]);
  const complete = (lesson: RuntimeLesson) =>
    projected.participationCompleted.includes(lesson.id) || projected.legacyCredits.includes(lesson.id);

  const completedLessonIds = pack.lessons
    .filter(complete)
    .map((lesson) => lesson.id);

  // The newest resumable draft whose lesson is real, current and unfinished.
  const unfinishedDraft = checkpoints.find((draft) => {
    if (draft.packId !== pack.id) return false;
    const lesson = pack.lessons.find((candidate) => candidate.id === draft.lessonId);
    if (!lesson || lesson.revision !== draft.revision) return false;
    if (complete(lesson)) return false;
    return lesson.steps.some((step) => step.id === draft.stepId);
  });
  const unfinishedLesson = unfinishedDraft
    ? pack.lessons.find((lesson) => lesson.id === unfinishedDraft.lessonId)!
    : null;

  const nextLesson =
    pack.lessons.find((lesson) => !complete(lesson) && lessonEligible(pack, lesson, projected)) ?? null;

  // Due reviews come from the same projection the scheduler writes: one entry
  // per evidence key, each with its own dueAt.
  const due = Object.entries(projected.evidence)
    .filter(([, evidence]) => evidence.dueAt <= now)
    .sort(([, a], [, b]) => a.dueAt.getTime() - b.dueAt.getTime());
  const homes = evidenceHomesFor(pack);

  return {
    packId: pack.id,
    language,
    totalLessons: pack.lessons.length,
    completedLessonCount: completedLessonIds.length,
    // Any projection signal at all. `events.length > 0` alone would be wrong:
    // events for a pack whose revision moved on are quarantined, and a learner
    // who has only quarantined history has nothing the app can act on.
    hasPractice:
      completedLessonIds.length > 0 ||
      Object.keys(projected.evidence).length > 0 ||
      unfinishedDraft !== undefined,
    nextLesson: nextLesson ? lessonRef(pack, nextLesson) : null,
    unfinished:
      unfinishedLesson && unfinishedDraft
        ? {
            ...lessonRef(pack, unfinishedLesson),
            stepIndex: unfinishedLesson.steps.findIndex((step) => step.id === unfinishedDraft.stepId) + 1,
            stepCount: unfinishedLesson.steps.length,
          }
        : null,
    dueReviewCount: due.length,
    dueTitles: due
      .map(([key]) => homes.get(key)?.label)
      .filter((label): label is string => !!label),
  };
}
