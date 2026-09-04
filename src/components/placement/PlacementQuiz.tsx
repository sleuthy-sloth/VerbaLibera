'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClozeBuilder } from '@/components/session/ClozeBuilder';
import sessionStyles from '@/components/session/session.module.css';
import { frenchPlacementItems, type PlacementItem } from '@/features/placement/items';
import {
  nextAdaptivePlacementItem,
  scoreAdaptivePlacement,
} from '@/features/placement/adaptive';
import type { PlacementResult } from '@/features/placement/score';

const DRAFT_KEY = 'verbalibera_placement:draft';
const RESULT_KEY = 'verbalibera_placement';

const BAND_COPY: Record<PlacementResult['band'], { title: string; detail: string }> = {
  A1: {
    title: 'Starting at the beginning',
    detail: 'French foundations — greetings, ordering, and everyday survival first.',
  },
  A2: {
    title: 'Beyond the basics',
    detail:
      'You placed past A1. Leveled A2 content is still being authored, so you start at the beginning with B1 stretch drills unlocked.',
  },
  B1: {
    title: 'Independent learner',
    detail: 'You placed at B1. Stretch drills are unlocked from the start.',
  },
  'B1+': {
    title: 'Above our current content',
    detail:
      'You placed above everything we have authored so far. Everything is open to you — B2 is on the roadmap, not in the app.',
  },
};

function ChoiceStep({
  item,
  value,
  onPick,
}: Readonly<{ item: PlacementItem; value: string; onPick: (value: string) => void }>) {
  return (
    <fieldset className={sessionStyles.responseSection}>
      <legend className={sessionStyles.eyebrow}>Choose the right response</legend>
      <div role="radiogroup" aria-label="Answer choices">
        {(item.choices ?? []).map((choice) => (
          <label key={choice} className={sessionStyles.responseInput} style={{ display: 'block', marginBottom: '0.5rem' }}>
            <input
              type="radio"
              name={`placement-${item.id}`}
              value={choice}
              checked={value === choice}
              onChange={() => onPick(choice)}
            />{' '}
            {choice}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type PlacementDraft = Readonly<{
  answers?: Record<string, string>;
  completedItemIds?: readonly string[];
}>;

export function PlacementQuiz({ courseSlug }: Readonly<{ courseSlug: string }>) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedItemIds, setCompletedItemIds] = useState<readonly string[]>([]);
  const [result, setResult] = useState<PlacementResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as PlacementDraft | null;
        if (draft?.answers) setAnswers(draft.answers);
        if (Array.isArray(draft?.completedItemIds)) setCompletedItemIds(draft.completedItemIds);
        const saved = JSON.parse(localStorage.getItem(RESULT_KEY) ?? 'null') as PlacementResult | null;
        if (saved && typeof saved.score === 'number') setResult(saved);
      } catch {
        // Fresh start when storage is unavailable or corrupt.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const item = nextAdaptivePlacementItem(frenchPlacementItems, answers, completedItemIds);
  const copy = result ? BAND_COPY[result.band] : null;

  const saveDraft = (nextAnswers: Record<string, string>, nextCompleted: readonly string[]) => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ answers: nextAnswers, completedItemIds: nextCompleted }),
      );
    } catch {
      // Draft persistence is best-effort.
    }
  };

  const record = (value: string) => {
    if (!item) return;
    const next = { ...answers, [item.id]: value };
    setAnswers(next);
    saveDraft(next, completedItemIds);
  };

  const finish = (finalAnswers = answers) => {
    const scored = scoreAdaptivePlacement(frenchPlacementItems, finalAnswers, courseSlug);
    setResult(scored);
    try {
      localStorage.setItem(RESULT_KEY, JSON.stringify(scored));
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Result persistence is best-effort.
    }
  };

  const advance = () => {
    if (!item) return;
    const nextCompleted = [...completedItemIds, item.id];
    const nextItem = nextAdaptivePlacementItem(frenchPlacementItems, answers, nextCompleted);
    if (nextItem) {
      setCompletedItemIds(nextCompleted);
      saveDraft(answers, nextCompleted);
    } else {
      setCompletedItemIds(nextCompleted);
      finish(answers);
    }
  };

  const goBack = () => {
    const nextCompleted = completedItemIds.slice(0, -1);
    setCompletedItemIds(nextCompleted);
    saveDraft(answers, nextCompleted);
  };

  const retake = () => {
    setAnswers({});
    setCompletedItemIds([]);
    setResult(null);
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(RESULT_KEY);
    } catch {
      // Best-effort cleanup.
    }
  };

  if (result && copy) {
    return (
      <main id="main-content" className={sessionStyles.session}>
        <p className={sessionStyles.eyebrow}>Placement result</p>
        <h1>
          {copy.title} — {result.score} of {result.total}
        </h1>
        <p>{copy.detail}</p>
        <div className={sessionStyles.actionDock}>
          <Link className={sessionStyles.primaryAction} href={`/learn/${courseSlug}/plan`}>
            Build my learning plan
            <span aria-hidden="true">→</span>
          </Link>
          <button type="button" onClick={retake}>
            Retake placement
          </button>
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main id="main-content" className={sessionStyles.session}>
        <p className={sessionStyles.eyebrow}>Placement</p>
        <h1>Your placement is ready.</h1>
        <button type="button" className={sessionStyles.primaryAction} onClick={() => finish()}>
          See my result
          <span aria-hidden="true">→</span>
        </button>
      </main>
    );
  }

  const current = answers[item.id] ?? '';
  const canAdvance = current.trim() !== '';
  const completesPlacement =
    nextAdaptivePlacementItem(frenchPlacementItems, answers, [...completedItemIds, item.id]) === null;

  return (
    <main id="main-content" className={sessionStyles.session}>
      <p className={sessionStyles.eyebrow}>
        Placement · question {completedItemIds.length + 1}
      </p>
      <h1>{item.prompt}</h1>
      <p className={sessionStyles.status}>
        This short check adapts to your answers, so you only see the levels that help us set your start.
      </p>
      <div className={sessionStyles.sessionProgress}>
        <progress
          aria-label="Placement progress"
          aria-valuetext={`Question ${completedItemIds.length + 1}`}
          max={9}
          value={completedItemIds.length + 1}
        />
      </div>

      {item.kind === 'CHOICE' ? (
        <ChoiceStep item={item} value={current} onPick={record} />
      ) : item.kind === 'CLOZE' ? (
        <ClozeBuilder
          key={item.id}
          template={item.prompt.replace(/^Complete[^:]*: /, '')}
          onAssemble={record}
        />
      ) : (
        <div className={sessionStyles.responseSection}>
          <label className={sessionStyles.eyebrow} htmlFor="placement-response">
            Your answer
          </label>
          <input
            id="placement-response"
            className={sessionStyles.responseInput}
            type="text"
            autoComplete="off"
            value={current}
            onChange={(event) => record(event.target.value)}
          />
        </div>
      )}

      <div className={sessionStyles.actionDock}>
        {completedItemIds.length > 0 ? (
          <button type="button" onClick={goBack}>
            Back
          </button>
        ) : null}
        <button
          type="button"
          className={sessionStyles.primaryAction}
          disabled={!canAdvance}
          onClick={advance}
        >
          {completesPlacement ? 'See my result' : 'Continue'}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}
