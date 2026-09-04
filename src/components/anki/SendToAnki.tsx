'use client';

import { useState } from 'react';
import { initialCourses } from '@/features/curriculum/fixture';
import { buildAnkiDeck } from '@/features/anki/notes';
import { ANKI_CONNECT_URL, pushDeckToAnki } from '@/features/anki/connect';
import styles from '@/components/session/session.module.css';

type Status =
  | { phase: 'idle' }
  | { phase: 'working'; detail: string }
  | { phase: 'done'; added: number; duplicates: number; total: number }
  | { phase: 'error'; message: string };

async function readMediaBytes(sourceUrl: string): Promise<Uint8Array> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${sourceUrl}`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * One-way export to Anki desktop via AnkiConnect (http://127.0.0.1:8765).
 * Anki must be open with the add-on installed; reviews stay in Anki —
 * nothing syncs back into VerbaLibera.
 */
export function SendToAnki({ courseSlug }: { courseSlug: string }) {
  const [status, setStatus] = useState<Status>({ phase: 'idle' });
  const course = initialCourses.find((entry) => entry.slug === courseSlug);
  if (!course) return null;

  const send = async () => {
    const deck = buildAnkiDeck(course);
    setStatus({ phase: 'working', detail: `Preparing ${deck.notes.length} cards…` });
    try {
      const result = await pushDeckToAnki(deck, {
        endpoint: ANKI_CONNECT_URL,
        readMedia: async (sourceUrl) => {
          setStatus({ phase: 'working', detail: `Reading ${sourceUrl.split('/').pop()}…` });
          return readMediaBytes(sourceUrl);
        },
      });
      setStatus({
        phase: 'done',
        added: result.added,
        duplicates: result.duplicates,
        total: result.total,
      });
    } catch (error) {
      setStatus({ phase: 'error', message: error instanceof Error ? error.message : 'Send failed.' });
    }
  };

  return (
    <section aria-label="Study in Anki" className={styles.practiceSay}>
      <p className={styles.eyebrow}>Study in Anki</p>
      <p className={styles.status}>
        Sends {buildAnkiDeck(course).notes.length} cards to Anki desktop (dialogues, recall, listening, vocab).
        Needs Anki open with the AnkiConnect add-on (Tools → Add-ons → Get Add-ons…, code 2055492159).
      </p>
      {status.phase === 'done' ? (
        <p className={styles.status} role="status">
          Sent to Anki: {status.added} new, {status.duplicates} already there ({status.total} total).
          {status.added === 0 ? ' Nothing new — your deck is up to date.' : ''}
        </p>
      ) : null}
      {status.phase === 'error' ? (
        <p className={styles.status} role="alert">
          {status.message}
        </p>
      ) : null}
      {status.phase === 'working' ? <p className={styles.status}>{status.detail}</p> : null}
      <div className={styles.practiceActions}>
        <button type="button" onClick={send} disabled={status.phase === 'working'}>
          {status.phase === 'working' ? 'Sending…' : status.phase === 'done' ? 'Send again' : 'Send to Anki'}
        </button>
      </div>
    </section>
  );
}
