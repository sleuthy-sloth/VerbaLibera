'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { hasUnavailableAudio } from './audio-availability';
import styles from './AudioPlayer.module.css';
import type { AudioPlayerHandle, AudioPlayerProps, AudioSegment } from './types';

export type { AudioPlayerHandle, AudioPlayerProps, AudioSegment } from './types';

type PlayerPhase =
  | 'ready'
  | 'starting'
  | 'playing'
  | 'responseTurn'
  | 'error'
  | 'complete'
  | 'empty'
  | 'unavailable';

type MediaListeners = {
  audio: HTMLAudioElement;
  ended: () => void;
  error: () => void;
};

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unable to play audio.');
}

function mayHandleSpacebar(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;

  return (
    event.code === 'Space' &&
    !event.repeat &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement) &&
    !target?.isContentEditable
  );
}

function phaseForSegments(segments: readonly AudioSegment[]): PlayerPhase {
  if (segments.length === 0) {
    return 'empty';
  }

  return hasUnavailableAudio(segments) ? 'unavailable' : 'ready';
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ segments, onResponseTurnComplete, onComplete, onError }, ref) {
    const [phase, setPhase] = useState<PlayerPhase>(() => phaseForSegments(segments));
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [error, setError] = useState<Error | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const mediaListenersRef = useRef<MediaListeners | null>(null);
    const sessionTokenRef = useRef(0);
    const currentIndexRef = useRef(-1);
    const pendingIndexRef = useRef(-1);
    const phaseRef = useRef<PlayerPhase>(phaseForSegments(segments));
    const completedTokenRef = useRef<number | null>(null);
    const callbacksRef = useRef({ onResponseTurnComplete, onComplete, onError });

    callbacksRef.current = { onResponseTurnComplete, onComplete, onError };

    const setPlayerPhase = useCallback((nextPhase: PlayerPhase) => {
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
    }, []);

    const removeMediaListeners = useCallback(() => {
      const activeListeners = mediaListenersRef.current;
      if (activeListeners) {
        activeListeners.audio.removeEventListener('ended', activeListeners.ended);
        activeListeners.audio.removeEventListener('error', activeListeners.error);
        mediaListenersRef.current = null;
      }
    }, []);

    const clearMedia = useCallback(() => {
      removeMediaListeners();
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      audio.pause();
      audio.removeAttribute('src');
    }, [removeMediaListeners]);

    const getAudio = useCallback((): HTMLAudioElement => {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      return audioRef.current;
    }, []);

    const finishLesson = useCallback(() => {
      const token = sessionTokenRef.current;
      if (completedTokenRef.current === token) {
        return;
      }

      completedTokenRef.current = token;
      setPlayerPhase('complete');
      callbacksRef.current.onComplete?.();
    }, [setPlayerPhase]);

    const startSegment = useCallback(
      async (index: number, token: number) => {
        const segment = segments[index];
        if (!segment || token !== sessionTokenRef.current) {
          return;
        }

        const audio = getAudio();
        pendingIndexRef.current = index;
        setPlayerPhase('starting');
        setError(null);
        removeMediaListeners();
        audio.src = segment.url;

        const failPlayback = (cause: unknown) => {
          if (
            token !== sessionTokenRef.current ||
            pendingIndexRef.current !== index
          ) {
            return;
          }

          removeMediaListeners();
          const playbackError = toError(cause);
          setError(playbackError);
          setPlayerPhase('error');
          callbacksRef.current.onError?.(playbackError);
        };

        const onEnded = () => {
          if (
            token !== sessionTokenRef.current ||
            currentIndexRef.current !== index ||
            phaseRef.current !== 'playing'
          ) {
            return;
          }

          removeMediaListeners();
          if (segment.pauseAfter) {
            setPlayerPhase('responseTurn');
            return;
          }

          const nextIndex = index + 1;
          if (nextIndex >= segments.length) {
            finishLesson();
            return;
          }

          void startSegment(nextIndex, token);
        };

        const onError = () => {
          failPlayback(new Error('Audio playback failed.'));
        };

        mediaListenersRef.current = { audio, ended: onEnded, error: onError };
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        try {
          await audio.play();
        } catch (cause) {
          failPlayback(cause);
          return;
        }

        if (token !== sessionTokenRef.current || phaseRef.current === 'error') {
          return;
        }

        currentIndexRef.current = index;
        setCurrentIndex(index);
        setPlayerPhase('playing');
      },
      [finishLesson, getAudio, removeMediaListeners, segments, setPlayerPhase],
    );

    const resetForSegments = useCallback(() => {
      sessionTokenRef.current += 1;
      completedTokenRef.current = null;
      clearMedia();
      currentIndexRef.current = -1;
      pendingIndexRef.current = -1;
      setCurrentIndex(-1);
      setError(null);

      const nextPhase = phaseForSegments(segments);
      setPlayerPhase(nextPhase);
      if (nextPhase === 'unavailable') {
        callbacksRef.current.onError?.(new Error('Audio unavailable for this lesson.'));
      }
    }, [clearMedia, segments, setPlayerPhase]);

    const startLesson = useCallback(() => {
      if (phaseRef.current !== 'ready') {
        return;
      }

      void startSegment(0, sessionTokenRef.current);
    }, [startSegment]);

    const retry = useCallback(() => {
      if (phaseRef.current !== 'error' || pendingIndexRef.current < 0) {
        return;
      }

      void startSegment(pendingIndexRef.current, sessionTokenRef.current);
    }, [startSegment]);

    const completeResponseTurn = useCallback(() => {
      if (phaseRef.current !== 'responseTurn') {
        return;
      }

      const token = sessionTokenRef.current;
      const nextIndex = currentIndexRef.current + 1;
      setPlayerPhase('starting');
      callbacksRef.current.onResponseTurnComplete?.();

      if (nextIndex >= segments.length) {
        finishLesson();
        return;
      }

      void startSegment(nextIndex, token);
    }, [finishLesson, segments.length, setPlayerPhase, startSegment]);

    const restart = useCallback(() => {
      resetForSegments();
    }, [resetForSegments]);

    useImperativeHandle(ref, () => ({ completeResponseTurn, restart }), [completeResponseTurn, restart]);

    useEffect(() => {
      resetForSegments();
    }, [resetForSegments]);

    useEffect(() => {
      return () => {
        sessionTokenRef.current += 1;
        clearMedia();
      };
    }, [clearMedia]);

    useEffect(() => {
      if (phase !== 'responseTurn') {
        return;
      }

      const onKeydown = (event: KeyboardEvent) => {
        if (!mayHandleSpacebar(event)) {
          return;
        }

        event.preventDefault();
        completeResponseTurn();
      };

      window.addEventListener('keydown', onKeydown);
      return () => window.removeEventListener('keydown', onKeydown);
    }, [completeResponseTurn, phase]);

    const currentSegment = currentIndex >= 0 ? segments[currentIndex] : null;
    const status =
      phase === 'ready'
        ? 'Ready to start.'
        : phase === 'starting'
          ? 'Starting audio.'
          : phase === 'playing'
            ? `Playing segment ${currentIndex + 1} of ${segments.length}.`
            : phase === 'responseTurn'
              ? 'Your response turn. Continue when you are ready.'
              : phase === 'error'
                ? 'Playback needs attention.'
                : phase === 'complete'
                  ? 'Lesson complete.'
                  : phase === 'empty'
                    ? 'No audio segments available.'
                    : 'Audio unavailable for this lesson.';

    return (
      <section className={styles.player} aria-label="Lesson audio player">
        <p role="status" aria-live="polite">
          {status}
        </p>
        {currentSegment?.transcript ? <p>{currentSegment.transcript}</p> : null}
        {phase === 'ready' ? (
          <button className={styles.control} type="button" aria-label="Start lesson" onClick={startLesson}>
            Start lesson
          </button>
        ) : null}
        {phase === 'responseTurn' ? (
          <button
            className={styles.control}
            type="button"
            aria-label={currentIndex + 1 < segments.length ? 'Continue' : 'Complete turn'}
            onClick={completeResponseTurn}
          >
            {currentIndex + 1 < segments.length ? 'Continue' : 'Complete turn'}
          </button>
        ) : null}
        {phase === 'error' ? (
          <>
            <p className={styles.error} role="alert">
              {error?.message ?? 'Unable to play audio.'}
            </p>
            <button className={styles.control} type="button" aria-label="Retry audio" onClick={retry}>
              Retry
            </button>
          </>
        ) : null}
        {phase === 'unavailable' ? <p className={styles.error} role="alert">Audio unavailable.</p> : null}
      </section>
    );
  },
);
