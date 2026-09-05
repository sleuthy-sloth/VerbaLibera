'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClozeBuilder } from '@/components/session/ClozeBuilder';
import sessionStyles from '@/components/session/session.module.css';
import { frenchPlacementItems, placementItemsFor, type PlacementItem } from '@/features/placement/items';
import { nextAdaptivePlacementItem, scoreAdaptivePlacement } from '@/features/placement/adaptive';
import { scorePlacement, type PlacementResult } from '@/features/placement/score';

const BAND_COPY: Record<PlacementResult['band'], { title: string; detail: string }> = {
  A1: { title: 'Starting at the beginning', detail: 'Begin with a guided lesson on the first foundation to revisit. You can explore every lesson at your own pace.' },
  A2: { title: 'Beyond the basics', detail: 'Your answers suggest some familiarity beyond beginner phrases. The available course currently covers A1 travel patterns; we recommend a useful foundation to revisit.' },
  B1: { title: 'Independent learner', detail: 'Your answers suggest familiarity with several intermediate patterns. This short check is an estimate; the available lessons currently cover A1 travel language.' },
  'B1+': { title: 'Above our current content', detail: 'You answered nearly all of this short check correctly. Our current lessons cover A1 travel language, so they may be revision for you. More advanced courses are still being developed.' },
};

function ChoiceStep({ item, value, onPick }: Readonly<{ item: PlacementItem; value: string; onPick: (value: string) => void }>) {
  return <fieldset className={sessionStyles.responseSection}>
    <legend className={sessionStyles.eyebrow}>Choose the right response</legend>
    <div role="radiogroup" aria-label="Answer choices">
      {(item.choices ?? []).map((choice) => <label key={choice} className={sessionStyles.responseInput} style={{ display: 'block', marginBottom: '0.5rem' }}>
        <input type="radio" name={`placement-${item.id}`} value={choice} checked={value === choice} onChange={() => onPick(choice)} />{' '}{choice}
      </label>)}
    </div>
  </fieldset>;
}

type PlacementDraft = Readonly<{ answers?: Record<string, string>; completedItemIds?: readonly string[] }>;

export function PlacementQuiz({ courseSlug }: Readonly<{ courseSlug: string }>) {
  const items = placementItemsFor(courseSlug);
  const adaptive = courseSlug === 'english-to-french';
  const resultKey = `verbalibera_placement:${courseSlug}`;
  const draftKey = `${resultKey}:draft`;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedItemIds, setCompletedItemIds] = useState<readonly string[]>([]);
  const [result, setResult] = useState<PlacementResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey) ?? 'null') as PlacementDraft | null;
        if (draft?.answers) setAnswers(draft.answers);
        if (Array.isArray(draft?.completedItemIds)) setCompletedItemIds(draft.completedItemIds);
        const saved = JSON.parse(localStorage.getItem(resultKey) ?? (courseSlug === 'english-to-french' ? localStorage.getItem('verbalibera_placement') ?? 'null' : 'null')) as PlacementResult | null;
        if (saved && typeof saved.score === 'number' && saved.band in BAND_COPY) setResult(saved);
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, [courseSlug, draftKey, resultKey]);

  const item = adaptive ? nextAdaptivePlacementItem(frenchPlacementItems, answers, completedItemIds) : items[index] ?? null;
  const saveDraft = (nextAnswers: Record<string, string>, nextCompleted: readonly string[]) => {
    try { localStorage.setItem(draftKey, JSON.stringify({ answers: nextAnswers, completedItemIds: nextCompleted })); } catch {}
  };
  const record = (value: string) => {
    if (!item) return;
    const next = { ...answers, [item.id]: value };
    setAnswers(next); saveDraft(next, completedItemIds);
  };
  const finish = (finalAnswers = answers) => {
    const scored = adaptive ? scoreAdaptivePlacement(frenchPlacementItems, finalAnswers, courseSlug) : scorePlacement(items, finalAnswers, courseSlug);
    setResult(scored);
    try { localStorage.setItem(resultKey, JSON.stringify(scored)); localStorage.removeItem(draftKey); } catch {}
  };
  const advance = () => {
    if (!item) return;
    if (adaptive) {
      const nextCompleted = [...completedItemIds, item.id];
      setCompletedItemIds(nextCompleted);
      if (nextAdaptivePlacementItem(frenchPlacementItems, answers, nextCompleted)) saveDraft(answers, nextCompleted); else finish(answers);
    } else if (index < items.length - 1) setIndex((value) => value + 1);
    else finish(answers);
  };
  const skip = () => {
    if (!item) return;
    const nextAnswers = { ...answers, [item.id]: '' };
    if (adaptive) {
      const nextCompleted = [...completedItemIds, item.id];
      setAnswers(nextAnswers); setCompletedItemIds(nextCompleted);
      if (nextAdaptivePlacementItem(frenchPlacementItems, nextAnswers, nextCompleted)) saveDraft(nextAnswers, nextCompleted); else finish(nextAnswers);
    } else if (index < items.length - 1) { setAnswers(nextAnswers); setIndex((value) => value + 1); saveDraft(nextAnswers, completedItemIds); }
    else finish(nextAnswers);
  };
  const goBack = () => {
    if (adaptive) { const nextCompleted = completedItemIds.slice(0, -1); setCompletedItemIds(nextCompleted); saveDraft(answers, nextCompleted); }
    else setIndex((value) => Math.max(0, value - 1));
  };
  const retake = () => { setAnswers({}); setCompletedItemIds([]); setIndex(0); setResult(null); try { localStorage.removeItem(draftKey); localStorage.removeItem(resultKey); } catch {} };

  if (result) {
    const copy = BAND_COPY[result.band];
    return <main id="main-content" className={sessionStyles.session}>
      <p className={sessionStyles.eyebrow}>Placement result</p>
      <h1>{copy.title} — {result.score} of {result.total}</h1>
      <p>{copy.detail}</p><p>This is a starting recommendation, not a CEFR certificate. Your result stays in this browser.</p>
      <div className={sessionStyles.actionDock}>
        <Link className={sessionStyles.primaryAction} href={`/learn/${courseSlug}/plan`}>Build my learning plan</Link>
        <Link className={sessionStyles.primaryAction} href={`/learn/${courseSlug}?concept=${result.startConceptId}`}>Start learning <span aria-hidden="true">→</span></Link>
        <button type="button" onClick={retake}>Retake placement</button>
      </div>
    </main>;
  }
  if (!item) return <main id="main-content" className={sessionStyles.session}><p className={sessionStyles.eyebrow}>Placement</p><h1>Your placement is ready.</h1><button type="button" className={sessionStyles.primaryAction} onClick={() => finish()}>See my result <span aria-hidden="true">→</span></button></main>;

  const current = answers[item.id] ?? '';
  const canAdvance = current.trim() !== '';
  const questionNumber = adaptive ? completedItemIds.length + 1 : index + 1;
  const total = adaptive ? 9 : items.length;
  const nextItem = adaptive ? nextAdaptivePlacementItem(frenchPlacementItems, answers, [...completedItemIds, item.id]) : null;
  const isLast = adaptive ? nextItem === null : index === items.length - 1;
  return <main id="main-content" className={sessionStyles.session}>
    <p className={sessionStyles.eyebrow}>Placement · question {questionNumber}{adaptive ? '' : ` of ${total}`}</p>
    <h1>{item.prompt}</h1><p>This optional check helps choose your first lesson. It is fine not to know an answer.</p>
    <Link href={`/learn/${courseSlug}`}>New to this language? Start with teaching</Link>
    <div className={sessionStyles.sessionProgress}><progress aria-label="Placement progress" aria-valuetext={`Question ${questionNumber}`} max={total} value={questionNumber} /></div>
    {item.kind === 'CHOICE' ? <ChoiceStep item={item} value={current} onPick={record} /> : item.kind === 'CLOZE' ? <ClozeBuilder key={item.id} template={item.prompt.replace(/^Complete[^:]*: /, '')} onAssemble={record} /> : <div className={sessionStyles.responseSection}><label className={sessionStyles.eyebrow} htmlFor="placement-response">Your answer</label><input id="placement-response" className={sessionStyles.responseInput} type="text" autoComplete="off" value={current} onChange={(event) => record(event.target.value)} /></div>}
    <div className={sessionStyles.actionDock}>
      {(adaptive ? completedItemIds.length > 0 : index > 0) ? <button type="button" onClick={goBack}>Back</button> : null}
      <button type="button" className={sessionStyles.primaryAction} disabled={!canAdvance} onClick={advance}>{isLast ? 'See my result' : 'Continue'} <span aria-hidden="true">→</span></button>
      <button type="button" onClick={skip}>I don’t know yet</button>
    </div>
  </main>;
}
