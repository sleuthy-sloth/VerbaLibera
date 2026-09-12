'use client';

import { useEffect, useState } from 'react';
import { usePracticeAccount } from '@/features/course-pack/AccountPractice';
import { readCheckpoints, readLessonEvents } from '@/features/course-pack/storage';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import { buildFoundationProgress } from './foundation-progress';
import { summarizeLearning, type LearningSummary } from './learning-summary';
import type { FoundationProgress } from './next-action';

/**
 * The dashboard's read of the course the learner is in.
 *
 * Everything else the Today card shows comes from the snapshot the server
 * composed; this is the one part that has to come off the device, because the
 * foundation player writes attempts, step completions and drafts into IndexedDB
 * and nowhere else. Two rules make it safe to put that on a first-paint surface:
 *
 * - **It never throws, and it never guesses.** A pack that will not load, a
 *   device whose storage will not open: both end at `unavailable`, which the
 *   card treats as "the snapshot decides" — never as an empty history.
 * - **It reads the scope the course shell writes to.** `usePracticeAccount` is
 *   the same store `HostedCourseWorkspace` binds its environment to, so the
 *   dashboard and the lesson player can never disagree about which practice is
 *   whose. That also means no identity request is made here: a learner who has
 *   not opted into account practice has their practice in the guest database,
 *   which is exactly where the lesson player would have put it.
 */

export type FoundationProgressState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'ready'; foundation: FoundationProgress; summary: LearningSummary }>;

export type FoundationProgressRequest = Readonly<{
  /** Pack slug (`french`) or null when the course has no foundation pack. */
  language: string | null;
}>;

const LOADING: FoundationProgressState = { status: 'loading' };

async function loadPack(slug: string) {
  const response = await fetch(`/packs/${slug}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`No pack for ${slug}`);
  return normalizePack(await response.json());
}

export function useFoundationProgress({ language }: FoundationProgressRequest): FoundationProgressState {
  const { scope, ready } = usePracticeAccount();
  // The read is stamped with what it was for. Switching language must not leave
  // the previous course's action on screen: a stale action is a wrong link.
  const key = `${scope ?? 'guest'}:${language ?? 'none'}`;
  const [loaded, setLoaded] = useState<Readonly<{ key: string; state: FoundationProgressState }>>({
    key: '',
    state: LOADING,
  });

  useEffect(() => {
    // `ready` is false until the stored scope is known; reading the guest
    // database in the meantime would show the wrong history for a frame.
    if (!ready) return;
    let active = true;
    // Deferred like the plan builder: the read happens after paint, so the
    // effect never sets state synchronously.
    const timer = setTimeout(() => {
      if (!language) {
        if (active) setLoaded({ key, state: { status: 'unavailable' } });
        return;
      }
      void (async () => {
        try {
          const [pack, events, checkpoints] = await Promise.all([
            loadPack(language),
            readLessonEvents(scope),
            readCheckpoints(scope),
          ]);
          if (!active) return;
          const now = new Date();
          setLoaded({
            key,
            state: {
              status: 'ready',
              foundation: buildFoundationProgress(pack, language, events, checkpoints, now),
              summary: summarizeLearning(pack, events, now),
            },
          });
        } catch {
          if (active) setLoaded({ key, state: { status: 'unavailable' } });
        }
      })();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, language, scope, ready]);

  return loaded.key === key ? loaded.state : LOADING;
}
