'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import sessionStyles from '@/components/session/session.module.css';
import { PlanBuilder } from '@/components/plan/PlanBuilder';
import { PlanOverview } from '@/components/plan/PlanOverview';
import { initialCourses } from '@/features/curriculum/fixture';
import type { CEFRLevel } from '@/features/curriculum/types';
import type { StudyPlan } from '@/features/study-plan/types';

function planKey(courseSlug: string) {
  return `verbalibera_plan:${courseSlug}`;
}

function doneKey(courseSlug: string) {
  return `verbalibera_plan_done:${courseSlug}`;
}

function placementStart(courseSlug: string): { startCefr: CEFRLevel; startConceptId: string } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(`verbalibera_placement:${courseSlug}`) ?? 'null') as {
      band?: string;
      startCefr?: CEFRLevel;
      startConceptId?: string;
    } | null;
    if (saved?.startConceptId && saved?.startCefr && initialCourses.find(course => course.slug === courseSlug)?.concepts.some(concept => concept.id === saved.startConceptId)) {
      return { startCefr: saved.startCefr, startConceptId: saved.startConceptId };
    }
  } catch {
    // Placement is optional; defaults apply.
  }
  return null;
}

function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

export function PlanSection({ courseSlug }: Readonly<{ courseSlug: string }>) {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(planKey(courseSlug)) ?? 'null') as StudyPlan | null;
        if (saved && Array.isArray(saved.weeks)) setPlan(saved);
        const flags = JSON.parse(localStorage.getItem(doneKey(courseSlug)) ?? 'null') as Record<
          string,
          boolean
        > | null;
        if (flags) setDone(flags);
      } catch {
        // Fresh start when storage is unavailable or corrupt.
      }
      setLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [courseSlug]);

  if (!loaded) return null;

  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);
  const fallbackConcept = course?.concepts[0]?.id ?? '';
  const placed = placementStart(courseSlug);

  const save = (next: StudyPlan) => {
    setPlan(next);
    try {
      localStorage.setItem(planKey(courseSlug), JSON.stringify(next));
    } catch {
      // Plan persistence is best-effort.
    }
  };

  const toggle = (key: string, checked: boolean) => {
    const next = { ...done, [key]: checked };
    setDone(next);
    try {
      localStorage.setItem(doneKey(courseSlug), JSON.stringify(next));
    } catch {
      // Best-effort.
    }
  };

  const reset = () => {
    setPlan(null);
    setDone({});
    try {
      localStorage.removeItem(planKey(courseSlug));
      localStorage.removeItem(doneKey(courseSlug));
    } catch {
      // Best-effort cleanup.
    }
  };

  return (
    <main id="main-content" className={sessionStyles.session}>
      <p className={sessionStyles.eyebrow}>
        <Link href="/">← Daily path</Link>
      </p>
      <h1>Your {course?.title ?? 'course'} study plan</h1>
      {plan ? (
        <PlanOverview plan={plan} todayIso={todayIso()} done={done} onToggle={toggle} onReset={reset} />
      ) : (
        <>
          {placed ? (
            <p>Prefilled from your placement result — adjust the pace to taste.</p>
          ) : (
            <p>
              No placement yet?{' '}
              <Link href={`/learn/${courseSlug}/placement`}>Take the 3-minute quiz</Link> to
              set your starting point.
            </p>
          )}
          <PlanBuilder
            courseSlug={courseSlug}
            startCefr={placed?.startCefr ?? 'A1'}
            startConceptId={placed?.startConceptId ?? fallbackConcept}
            onSave={save}
          />
        </>
      )}
    </main>
  );
}
