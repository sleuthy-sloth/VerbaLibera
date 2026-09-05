'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClozeBuilder } from '@/components/session/ClozeBuilder';
import sessionStyles from '@/components/session/session.module.css';
import { placementItemsFor, type PlacementItem } from '@/features/placement/items';
import { scorePlacement, type PlacementResult } from '@/features/placement/score';



const BAND_COPY: Record<PlacementResult['band'], { title: string; detail: string }> = {
  A1: {
    title: 'Starting at the beginning',
    detail: 'Begin with a guided lesson on the first foundation to revisit. You can explore every lesson at your own pace.',
  },
  A2: {
    title: 'Beyond the basics',
    detail:
      'Your answers suggest some familiarity beyond beginner phrases. The available course currently covers A1 travel patterns; we recommend a useful foundation to revisit.',
  },
  B1: {
    title: 'Independent learner',
    detail: 'Your answers suggest familiarity with several intermediate patterns. This short check is an estimate; the available lessons currently cover A1 travel language.',
  },
  'B1+': {
    title: 'Above our current content',
    detail:
      'You answered nearly all of this short check correctly. Our current lessons cover A1 travel language, so they may be revision for you. More advanced courses are still being developed.',
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
  const items = placementItemsFor(courseSlug);
  const RESULT_KEY = `verbalibera_placement:${courseSlug}`;
  const DRAFT_KEY = `${RESULT_KEY}:draft`;
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
        const saved = JSON.parse((localStorage.getItem(RESULT_KEY) ?? (courseSlug === 'english-to-french' ? localStorage.getItem('verbalibera_placement') : null)) ?? 'null') as PlacementResult | null;
        if (saved && typeof saved.score === 'number' && saved.band in BAND_COPY) setResult(saved);
      } catch {
        // Fresh start when storage is unavailable or corrupt.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [courseSlug, DRAFT_KEY, RESULT_KEY]);

  const item = items[index];
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

  const finish = (finalAnswers = answers) => {
    const scored = scorePlacement(items, finalAnswers, courseSlug);
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
        <p>This is a starting recommendation, not a CEFR certificate. Your result stays in this browser.</p>
        <div className={sessionStyles.actionDock}>
          <Link className={sessionStyles.primaryAction} href={`/learn/${courseSlug}?concept=${result.startConceptId}`}>
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
        Placement · {index + 1} of {items.length}
      </p>
      <h1>{item.prompt}</h1>
      <p>This optional check helps choose your first lesson. It is fine not to know an answer.</p>
      <Link href={`/learn/${courseSlug}`}>New to this language? Start with teaching</Link>
      <div className={sessionStyles.sessionProgress}>
        <progress
          aria-label="Placement progress"
          aria-valuetext={`Question ${index + 1} of ${items.length}`}
          max={items.length}
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
        <button type="button" onClick={() => {
          record('');
          if (index < items.length - 1) setIndex(index + 1);
          else finish({ ...answers, [item.id]: '' });
        }}>I don’t know yet</button>
        {index > 0 ? (
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            Back
          </button>
        ) : null}
        {index < items.length - 1 ? (
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
            onClick={() => finish()}
          >
            See my result
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </main>
  );
}
