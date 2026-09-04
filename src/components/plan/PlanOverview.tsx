'use client';

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
      {plan.frontier ? (
        <p role="note">
          {plan.frontier.note} Your plan covers through {plan.frontier.coveredThrough}.
        </p>
      ) : null}
      {plan.weeks.map((week, weekIndex) => (
        <section key={week.startsOn} aria-labelledby={`plan-week-${weekIndex}`}>
          <h2 id={`plan-week-${weekIndex}`}>
            Week {weekIndex + 1} · starts {week.startsOn}
            {weekIndex === current ? ' · this week' : ''}
          </h2>
          <ul>
            {week.items.map((item, itemIndex) => {
              const key = planItemKey(weekIndex, itemIndex, item.conceptId, item.mode, item.drillId);
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
                    {MODE_LABEL[item.mode] ?? item.mode} · {item.conceptId}
                  </label>
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
