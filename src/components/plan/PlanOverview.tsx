'use client';

import Link from 'next/link';
import { initialCourses } from '@/features/curriculum/fixture';
import sessionStyles from '@/components/session/session.module.css';
import type { StudyPlan } from '@/features/study-plan/types';

export function planItemKey(
  weekIndex: number,
  itemIndex: number,
  conceptId: string,
  mode: string,
  drillId?: string,
) {
  return `${weekIndex}:${itemIndex}:${mode}:${conceptId}:${drillId ?? ''}`;
export function planItemKey(weekIndex: number, conceptId: string, mode: string, drillId?: string, occurrence = 0) {
  return `${weekIndex}:${mode}:${conceptId}:${drillId ?? ''}:${occurrence}`;
}

function isWeekComplete(plan: StudyPlan, weekIndex: number, done: Record<string, boolean>): boolean {
  const week = plan.weeks[weekIndex];
  return Boolean(
    week &&
      week.items.length > 0 &&
      week.items.every((item, itemIndex) =>
        done[planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId)],
      ),
  );
}

// Position-based progression: missed days do not skip learners ahead.
export function currentWeekIndex(plan: StudyPlan, done: Record<string, boolean>): number {
  const firstIncomplete = plan.weeks.findIndex((_, weekIndex) => !isWeekComplete(plan, weekIndex, done));
  return firstIncomplete === -1 ? Math.max(0, plan.weeks.length - 1) : firstIncomplete;
}

const MODE_LABEL: Record<string, string> = { teach: 'Learn', drill: 'Drill', review: 'Review' };

export function PlanOverview({
  plan,
  done,
  onToggle,
  onReset,
}: Readonly<{
  plan: StudyPlan;
  done: Record<string, boolean>;
  onToggle: (key: string, checked: boolean) => void;
  onReset: () => void;
}>) {
  const current = currentWeekIndex(plan, done);
  const current = currentWeekIndex(plan, todayIso);
  const doneCount = plan.weeks.reduce((sum, week, index) => sum + week.items.filter((item, occurrence) =>
    done[planItemKey(index, item.conceptId, item.mode, item.drillId, occurrence)]).length, 0);
  const totalCount = plan.weeks.reduce((sum, week) => sum + week.items.length, 0);
  const doneCount = plan.weeks.reduce(
    (sum, week, weekIndex) =>
      sum +
      week.items.filter((item, itemIndex) =>
        done[planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId)],
      ).length,
    0,
  );

  return (
    <div>
      <p className={sessionStyles.eyebrow}>
        Week {current + 1} of {plan.weeks.length} · {plan.targetLevel} track
      </p>
      <p aria-live="polite">
        {doneCount} of {totalCount} items done
      </p>
      <p className={sessionStyles.prompt}>Your personal checklist is stored in this browser. Check off each practice when you finish; this does not certify mastery.</p>
      {plan.frontier ? (
        <p role="note">
          {plan.frontier.note} Your plan covers through {plan.frontier.coveredThrough}.
        </p>
      ) : null}
      {plan.weeks.map((week, weekIndex) => (
        <section className={sessionStyles.planWeek} key={week.startsOn} aria-labelledby={`plan-week-${weekIndex}`}>
          <h2 id={`plan-week-${weekIndex}`}>
            Week {weekIndex + 1} · starts {week.startsOn}
            {weekIndex === current ? ' · this week' : ''}
          </h2>
          <ul>
            {week.items.map((item, itemIndex) => {
              const key = planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId);
          <ul className={sessionStyles.planChecklist}>
            {week.items.map((item, occurrence) => {
              const key = planItemKey(weekIndex, item.conceptId, item.mode, item.drillId, occurrence);
              const id = `plan-done-${key.replace(/[^a-z0-9]+/gi, '-')}`;
              return (
                <li key={key}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={done[key] ?? false}
                    onChange={(event) => onToggle(key, event.target.checked)}
                  />{' '}
                  <label htmlFor={id}>
                    {MODE_LABEL[item.mode] ?? item.mode} · {initialCourses.find(course => course.slug === plan.courseSlug)?.concepts.find(concept => concept.id === item.conceptId)?.scenario ?? 'Practice pattern'}
                  </label>
                  <Link href={`/learn/${plan.courseSlug}?concept=${item.conceptId}`} aria-label={`Open lesson: ${initialCourses.find(course => course.slug === plan.courseSlug)?.concepts.find(concept => concept.id === item.conceptId)?.scenario ?? 'Practice pattern'}`}>Study<span aria-hidden="true"> →</span></Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className={sessionStyles.actionDock}>
        <button type="button" onClick={onReset}>
          Start over with a new plan
        </button>
      </div>
    </div>
  );
}
