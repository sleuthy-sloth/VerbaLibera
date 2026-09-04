'use client';

import { useMemo, useState } from 'react';
import sessionStyles from '@/components/session/session.module.css';
import { initialCourses } from '@/features/curriculum/fixture';
import type { CEFRLevel } from '@/features/curriculum/types';
import { generatePlan } from '@/features/study-plan/generate';
import type { PaceInput, StudyPlan } from '@/features/study-plan/types';

const MINUTES_OPTIONS = [5, 8, 15] as const;
const TARGET_OPTIONS: readonly CEFRLevel[] = ['A2', 'B1', 'B2'];

function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

export function PlanBuilder({
  courseSlug,
  startCefr,
  startConceptId,
  onSave,
}: Readonly<{
  courseSlug: string;
  startCefr: CEFRLevel;
  startConceptId: string;
  onSave: (plan: StudyPlan) => void;
}>) {
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [minutesPerDay, setMinutesPerDay] = useState<(typeof MINUTES_OPTIONS)[number]>(8);
  const [targetLevel, setTargetLevel] = useState<CEFRLevel>('B1');
  const [startDate, setStartDate] = useState(todayIso);

  const concepts = useMemo(
    () => initialCourses.find((course) => course.slug === courseSlug)?.concepts ?? [],
    [courseSlug],
  );

  const preview = useMemo(() => {
    const input: PaceInput = {
      courseSlug,
      startCefr,
      startConceptId,
      daysPerWeek,
      minutesPerDay,
      targetLevel,
      startDate,
    };
    return generatePlan(input, concepts);
  }, [courseSlug, startCefr, startConceptId, daysPerWeek, minutesPerDay, targetLevel, startDate, concepts]);

  return (
    <div className={sessionStyles.responseSection}>
      <p className={sessionStyles.eyebrow}>Build your plan</p>

      <label className={sessionStyles.eyebrow} htmlFor="plan-days">
        Days per week: {daysPerWeek}
      </label>
      <input
        id="plan-days"
        className={sessionStyles.responseInput}
        type="range"
        min={1}
        max={7}
        step={1}
        value={daysPerWeek}
        onChange={(event) => setDaysPerWeek(Number(event.target.value))}
      />

      <fieldset>
        <legend className={sessionStyles.eyebrow}>Minutes per day</legend>
        <div role="radiogroup" aria-label="Minutes per day">
          {MINUTES_OPTIONS.map((minutes) => (
            <label key={minutes} style={{ marginRight: '1rem' }}>
              <input
                type="radio"
                name="plan-minutes"
                value={minutes}
                checked={minutesPerDay === minutes}
                onChange={() => setMinutesPerDay(minutes)}
              />{' '}
              {minutes}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={sessionStyles.eyebrow}>Target level</legend>
        <div role="radiogroup" aria-label="Target level">
          {TARGET_OPTIONS.map((level) => (
            <label key={level} style={{ marginRight: '1rem' }}>
              <input
                type="radio"
                name="plan-target"
                value={level}
                checked={targetLevel === level}
                onChange={() => setTargetLevel(level)}
              />{' '}
              {level}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={sessionStyles.eyebrow} htmlFor="plan-start">
        Start date
      </label>
      <input
        id="plan-start"
        className={sessionStyles.responseInput}
        type="date"
        value={startDate}
        onChange={(event) => setStartDate(event.target.value || todayIso())}
      />

      <p aria-live="polite">
        {preview.weeks.length} {preview.weeks.length === 1 ? 'week' : 'weeks'} ·{' '}
        {preview.weeks.reduce((sum, week) => sum + week.items.length, 0)} plan items · starts{' '}
        {preview.weeks[0]?.startsOn ?? startDate}
      </p>
      {preview.frontier ? <p>{preview.frontier.note}</p> : null}

      <div className={sessionStyles.actionDock}>
        <button type="button" className={sessionStyles.primaryAction} onClick={() => onSave(preview)}>
          Save my plan
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
