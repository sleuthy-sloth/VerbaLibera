import {
  mergeLearningEvents,
  projectLessonEvidence,
  type ActivityAttempt,
  type LearningEvent,
} from '@/features/course-pack/attempts';
import type { RuntimePack, Skill } from '@/features/course-pack/lesson-runtime';
import { isGradedActivity } from '@/features/course-pack/lesson-runtime';

/**
 * What a learner has actually practised, in words they can read.
 *
 * The dashboard used to say nothing about foundation progress, and `/you`
 * derived "What you can say" from the snapshot's guided session — so a learner
 * with twenty foundation phrases behind them read "Nothing yet. Finish a lesson
 * and the pattern you learn shows up here."
 *
 * Three rules hold this module to honesty:
 *
 * 1. **It reads the projection, it does not re-derive one.** Completion, legacy
 *    credit, the review queue and the quarantine list all come from
 *    `projectLessonEvidence`, the same function the course shell gates lessons
 *    with. A second evidence path is how a learner finishes a lesson and their
 *    progress says otherwise.
 * 2. **The four histories stay separate.** Recognition, production and
 *    listening are counted from accepted attempts, one bucket per attempt;
 *    self-assessment is a self-rating on a `self-compare` step and is reported
 *    on its own line. There is deliberately no function here that adds them
 *    together.
 * 3. **No figure is a proficiency claim.** "Phrases practised", "situations
 *    tried" — counts of what happened, never a level, a percentage or a score.
 */

export type Modality = 'recognition' | 'production' | 'listening';

export type ModalityCounts = Readonly<{ independent: number; assisted: number }>;

export type RevisitItem = Readonly<{
  /** The concept behind the evidence: "Ordering a coffee". */
  label: string;
  /** The lesson it came from, so a surface can link instead of teasing. */
  lessonId: string;
  /** Due now, or not yet due but last answered shakily. */
  state: 'due' | 'shaky';
  dueAt: string;
}>;

export type LearningSummary = Readonly<{
  /** Distinct evidence keys with at least one independent success. */
  phrasesPractised: number;
  /** Lessons with a live attempt or completion, over the pack's total. */
  situationsAttempted: number;
  situationsTotal: number;
  /** Due first (soonest first), then the shaky ones (most failures first). */
  revisit: readonly RevisitItem[];
  recognition: ModalityCounts;
  production: ModalityCounts;
  listening: ModalityCounts;
  /**
   * Self-assessment: how many times the learner listened back and rated
   * themselves, and how. Never folded into the figures above — hearing yourself
   * is not retrieval, and a self-rating is not a grade.
   */
  selfAssessment: Readonly<{ checks: number; comfortable: number; again: number }>;
}>;

/**
 * A learner-facing bucket for an activity's skills.
 *
 * Deliberately its own function rather than `skillMode` from `attempts.ts`:
 * that one asks the scheduler which review interval a phrase belongs to and
 * folds `speaking` in with recognition, because a spoken line has no answer to
 * grade. To a learner, saying it out loud is production. `listening` wins in
 * both, so the two agree wherever they overlap;
 * `tests/learning-summary.test.ts` pins the difference as a decision.
 *
 * One bucket per activity, not one per skill: `skillCounts` counts a
 * `['reading','vocabulary']` step under both skills, which would show a learner
 * two recognition credits for a single answer.
 */
export function modalityForSkills(skills: readonly Skill[]): Modality {
  if (skills.includes('listening')) return 'listening';
  if (skills.includes('writing') || skills.includes('speaking')) return 'production';
  return 'recognition';
}

/** Where each evidence key came from, so a due phrase can be named and linked. */
export type EvidenceHome = Readonly<{ label: string; lessonId: string }>;

export function evidenceHomesFor(pack: RuntimePack): Map<string, EvidenceHome> {
  const conceptTitle = new Map(pack.concepts.map((concept) => [concept.id, concept.title]));
  const lessonOfActivity = new Map<string, string>();
  for (const lesson of pack.lessons) {
    for (const step of lesson.steps) {
      if (!lessonOfActivity.has(step.activityId)) lessonOfActivity.set(step.activityId, lesson.id);
    }
  }
  const homes = new Map<string, EvidenceHome>();
  for (const activity of Object.values(pack.activities)) {
    if (!('evidenceKey' in activity) || homes.has(activity.evidenceKey)) continue;
    const lessonId = lessonOfActivity.get(activity.id);
    if (!lessonId) continue;
    const concept = activity.conceptIds.length > 0 ? conceptTitle.get(activity.conceptIds[0]) : undefined;
    homes.set(activity.evidenceKey, { label: concept ?? activity.prompt, lessonId });
  }
  return homes;
}

export function summarizeLearning(
  pack: RuntimePack,
  events: readonly LearningEvent[],
  now: Date,
): LearningSummary {
  const merged = mergeLearningEvents([...events]);
  const projected = projectLessonEvidence(pack, merged);
  const homes = evidenceHomesFor(pack);
  const quarantined = new Set(projected.quarantined);

  // Phrases: the same evidence keys the scheduler holds, counted once each.
  let phrasesPractised = 0;
  const due: RevisitItem[] = [];
  const shaky: Array<{ item: RevisitItem; failures: number }> = [];
  for (const [key, evidence] of Object.entries(projected.evidence)) {
    if (evidence.successes > 0) phrasesPractised += 1;
    const home = homes.get(key);
    if (!home) continue;
    if (evidence.dueAt <= now) {
      due.push({ label: home.label, lessonId: home.lessonId, state: 'due', dueAt: evidence.dueAt.toISOString() });
    } else if (evidence.lastQuality < 3) {
      shaky.push({
        item: { label: home.label, lessonId: home.lessonId, state: 'shaky', dueAt: evidence.dueAt.toISOString() },
        failures: evidence.failures,
      });
    }
  }
  due.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.label.localeCompare(b.label));
  shaky.sort((a, b) => b.failures - a.failures || a.item.label.localeCompare(b.item.label));

  // Everything the projection kept: attempts and step completions it validated.
  const live = merged.filter(
    (event) => event.packId === pack.id && !quarantined.has(event.id),
  );

  // Situations: a lesson the learner has touched, by any route the projection
  // recognises — participation, legacy credit, or a surviving event.
  const known = new Set(pack.lessons.map((lesson) => lesson.id));
  const attempted = new Set<string>(
    [...projected.participationCompleted, ...projected.legacyCredits].filter((id) => known.has(id)),
  );
  for (const event of live) {
    if ('eventVersion' in event && (event.type === 'attempt' || event.type === 'step-completed'))
      attempted.add(event.lessonId);
  }

  const counts: Record<Modality, { independent: number; assisted: number }> = {
    recognition: { independent: 0, assisted: 0 },
    production: { independent: 0, assisted: 0 },
    listening: { independent: 0, assisted: 0 },
  };
  let checks = 0;
  let comfortable = 0;
  let again = 0;
  for (const event of live) {
    if (!('eventVersion' in event) || event.type !== 'attempt') continue;
    const attempt = event as ActivityAttempt;
    const activity = pack.activities[attempt.activityId];
    if (!activity) continue;
    if (activity.kind === 'self-compare') {
      // Kept apart on purpose: a self-compare step carries no evidence key, and
      // the projection files its `self-assessed` outcome outside the evidence.
      if (attempt.evaluation.outcome !== 'self-assessed' || attempt.response.kind !== 'self') continue;
      checks += 1;
      if (attempt.response.rating === 'comfortable') comfortable += 1;
      else again += 1;
      continue;
    }
    if (!isGradedActivity(activity)) continue;
    if (attempt.evaluation.outcome !== 'correct') continue;
    const bucket = counts[modalityForSkills(activity.skills)];
    if (attempt.evaluation.independent) bucket.independent += 1;
    else bucket.assisted += 1;
  }

  return {
    phrasesPractised,
    situationsAttempted: attempted.size,
    situationsTotal: pack.lessons.length,
    revisit: [...due, ...shaky.map((entry) => entry.item)],
    recognition: counts.recognition,
    production: counts.production,
    listening: counts.listening,
    selfAssessment: { checks, comfortable, again },
  };
}
