'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClozeBuilder } from '@/components/session/ClozeBuilder';
import sessionStyles from '@/components/session/session.module.css';
import { frenchPlacementItems, type PlacementItem } from '@/features/placement/items';
import { scorePlacement, type PlacementResult } from '@/features/placement/score';

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

export function PlacementQuiz({ courseSlug }: Readonly<{ courseSlug: string }>) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);

  // Restore draft/result after mount (deferred so the effect never sets
  // state synchronously, and SSR prerender stays mismatch-free).
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as {
          answers?: Record<string, string>;
        } | null;
        if (draft?.answers) setAnswers(draft.answers);
        const saved = JSON.parse(localStorage.getItem(RESULT_KEY) ?? 'null') as PlacementResult | null;
        if (saved && typeof saved.score === 'number') setResult(saved);
      } catch {
        // Fresh start when storage is unavailable or corrupt.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const item = frenchPlacementItems[index];
  if (!item) return null;
  const copy = result ? BAND_COPY[result.band] : null;

  const record = (value: string) => {
    const next = { ...answers, [item.id]: value };
    setAnswers(next);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: next }));
    } catch {
      // Draft persistence is best-effort.
    }
  };

  const finish = () => {
    const scored = scorePlacement(frenchPlacementItems, answers, courseSlug);
    setResult(scored);
    try {
      localStorage.setItem(RESULT_KEY, JSON.stringify(scored));
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Result persistence is best-effort.
    }
  };

  const retake = () => {
    setAnswers({});
    setIndex(0);
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
          <Link className={sessionStyles.primaryAction} href={`/learn/${courseSlug}`}>
            Start learning
            <span aria-hidden="true">→</span>
          </Link>
          <button type="button" onClick={retake}>
            Retake placement
          </button>
        </div>
      </main>
    );
  }

  const current = answers[item.id] ?? '';
  const canAdvance = current.trim() !== '';

  return (
    <main id="main-content" className={sessionStyles.session}>
      <p className={sessionStyles.eyebrow}>
        Placement · {index + 1} of {frenchPlacementItems.length}
      </p>
      <h1>{item.prompt}</h1>
      <div className={sessionStyles.sessionProgress}>
        <progress
          aria-label="Placement progress"
          aria-valuetext={`Question ${index + 1} of ${frenchPlacementItems.length}`}
          max={frenchPlacementItems.length}
          value={index + 1}
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
        {index > 0 ? (
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            Back
          </button>
        ) : null}
        {index < frenchPlacementItems.length - 1 ? (
          <button
            type="button"
            className={sessionStyles.primaryAction}
            disabled={!canAdvance}
            onClick={() => setIndex((i) => i + 1)}
          >
            Continue
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            type="button"
            className={sessionStyles.primaryAction}
            disabled={!canAdvance}
            onClick={finish}
          >
            See my result
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </main>
  );
}
