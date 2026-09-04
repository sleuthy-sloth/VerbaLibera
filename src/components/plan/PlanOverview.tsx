'use client';

import sessionStyles from '@/components/session/session.module.css';
import type { StudyPlan } from '@/features/study-plan/types';

export function planItemKey(weekIndex: number, conceptId: string, mode: string, drillId?: string) {
  return `${weekIndex}:${mode}:${conceptId}:${drillId ?? ''}`;
}

// Position-based week: skipped days push the schedule instead of shaming it.
// Completion binding to the daily session arrives in Slice 3; until then the
// checklist persists locally.
export function currentWeekIndex(plan: StudyPlan, todayIso: string): number {
  const [year, month, day] = todayIso.split('-').map(Number);
  const today = Date.UTC(year!, month! - 1, day!);
  let current = 0;
  plan.weeks.forEach((week, index) => {
    const [wy, wm, wd] = week.startsOn.split('-').map(Number);
    if (Date.UTC(wy!, wm! - 1, wd!) <= today) current = index;
  });
  return current;
}

const MODE_LABEL: Record<string, string> = { teach: 'Learn', drill: 'Drill', review: 'Review' };

export function PlanOverview({
  plan,
  todayIso,
  done,
  onToggle,
  onReset,
}: Readonly<{
  plan: StudyPlan;
  todayIso: string;
  done: Record<string, boolean>;
  onToggle: (key: string, checked: boolean) => void;
  onReset: () => void;
}>) {
  const current = currentWeekIndex(plan, todayIso);
  const doneCount = Object.values(done).filter(Boolean).length;
  const totalCount = plan.weeks.reduce((sum, week) => sum + week.items.length, 0);

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
            {week.items.map((item) => {
              const key = planItemKey(weekIndex, item.conceptId, item.mode, item.drillId);
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
