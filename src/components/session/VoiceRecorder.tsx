'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './session.module.css';

type RecorderState = 'idle' | 'requesting' | 'recording' | 'ready' | 'unsupported' | 'denied';

/**
 * In-memory voice practice: records via MediaRecorder, plays back from a
 * Blob URL, and revokes it on unmount. Nothing is uploaded or persisted —
 * the recording lives only in this tab and is discarded on advance.
 */
export function VoiceRecorder() {
  const [state, setState] = useState<RecorderState>(() => {
    if (typeof navigator === 'undefined') return 'unsupported';
    const devices = navigator.mediaDevices as MediaDevices | undefined;
    return typeof devices?.getUserMedia === 'function' ? 'idle' : 'unsupported';
  });
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const url = recordingUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordingUrl]);

  const start = async () => {
    if (state === 'recording' || state === 'requesting') return;
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordingUrl(URL.createObjectURL(blob));
        setState('ready');
      };
      recorder.start();
      setState('recording');
    } catch {
      setState('denied');
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const discard = () => {
    setRecordingUrl(null);
    setState('idle');
  };

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
