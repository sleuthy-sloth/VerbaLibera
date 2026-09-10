'use client';

import { useVoiceRecorder } from '@/lib/use-voice-recorder';
import styles from './session.module.css';

/**
 * In-memory voice practice: records via MediaRecorder, plays back from a
 * Blob URL, and revokes it on unmount. Nothing is uploaded or persisted —
 * the recording lives only in this tab and is discarded on advance.
 *
 * The recorder itself lives in `useVoiceRecorder` so the lesson player's
 * `self-compare` step can record too. This component owns only the guided
 * session's presentation of it.
 */
export function VoiceRecorder() {
  const { state, recordingUrl, start, stop, discard } = useVoiceRecorder();

  if (state === 'unsupported') {
    return (
      <p className={styles.status} role="note">
        Voice practice needs a browser with microphone recording.
      </p>
    );
  }

  return (
    <div className={styles.practiceSay}>
      <p className={styles.eyebrow}>Practice saying it</p>
      {state === 'denied' ? (
        <p className={styles.status} role="note">
          Microphone is blocked — allow access to record, or just listen and repeat aloud.
        </p>
      ) : state === 'ready' && recordingUrl ? (
        <>
          <audio controls preload="none" src={recordingUrl} aria-label="Your recording" />
          <div className={styles.practiceActions}>
            <button type="button" onClick={discard}>
              Record again
            </button>
          </div>
          <p className={styles.status}>Compare with the model clip above. Nothing was uploaded.</p>
        </>
      ) : (
        <button
          type="button"
          onClick={state === 'recording' ? stop : start}
          disabled={state === 'requesting'}
          aria-live="polite"
        >
          {state === 'recording' ? 'Stop recording' : state === 'requesting' ? 'Starting…' : 'Record yourself'}
        </button>
      )}
    </div>
  );
}
