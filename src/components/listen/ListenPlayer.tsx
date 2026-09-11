"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListenTrack } from "@/features/listen/tracks";
import { langCodeFor } from "@/features/course-pack/language-code";
import { listenedAt, markListened } from "@/features/listen/listened";
import {
  clearPosition,
  readPosition,
  savePosition,
} from "@/features/listen/position";
import styles from "./listen-player.module.css";

/** `183.4` → `3:03`. Used for the resume notice and the transcript markers. */
export function formatPosition(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

// Audio-only lesson player. Lock-screen / control-center metadata comes from
// the Media Session API (guarded: jsdom and old browsers lack it). Finishing
// a track marks it listened — heard, not mastered.
//
// Quitting halfway used to lose the place, which for an eleven-minute track is
// the difference between finishing it and never opening it again. The player now
// remembers where the learner stopped (browser-local, see
// `src/features/listen/position.ts`), says so before playing, and offers to
// start over. Seeking is the native control's job; this only makes a seek mean
// something after a cold start.
export function ListenPlayer({
  track,
  courseTitle,
  lessonTitle,
}: {
  track: ListenTrack;
  courseTitle: string;
  lessonTitle?: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const [resumedTo, setResumedTo] = useState<number | null>(null);
  const applied = useRef(false);
  const lastSaved = useRef(0);
  // The lesson the learner picked names the player. The track's own label
  // describes the recording, so it is only the fallback when the course has
  // not loaded yet.
  const title = lessonTitle ?? track.lessonTitle;

  useEffect(() => {
    const timer = setTimeout(() => {
      setHeard(listenedAt(track.lessonId));
      setResumeFrom(readPosition(track.lessonId));
      setResumedTo(null);
      applied.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [track.lessonId]);

  const persist = useCallback(() => {
    const element = audio.current;
    if (!element) return;
    lastSaved.current = element.currentTime;
    const kept = savePosition(track.lessonId, element.currentTime, element.duration);
    if (kept === null) setResumeFrom(null);
  }, [track.lessonId]);

  // A tab that is closed or backgrounded is the common way to leave a long
  // track, and `pause` does not always fire first.
  useEffect(() => {
    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [persist]);

  useEffect(() => {
    const media = navigator.mediaSession;
    if (!media) return;
    try {
      media.metadata = new MediaMetadata({
        title: `${title} · audio lesson`,
        artist: "VerbaLibera",
        album: courseTitle,
      });
    } catch {
      // Older browsers: the player still works, just without lock-screen art.
    }
  }, [track.lessonId, title, courseTitle]);

  return (
    <section aria-label={`Audio lesson: ${title}`} className={styles.player}>
      <h2>{title}</h2>
      {track.reviewPending ? (
        <p className={styles.note}>Machine-recorded. A native-speaker check is still pending.</p>
      ) : null}
      <p className={styles.lede}>
        Listen and think — predict each answer aloud before the reveal. No
        typing, no score. About {Math.round(track.durationS / 60)} minutes.
      </p>
      {heard ? (
        <p role="status" className={styles.heard}>
          Listened {new Date(heard).toLocaleDateString()}. Heard, not mastered — replay any time.
        </p>
      ) : null}
      {resumeFrom !== null ? (
        <p role="status" className={styles.resumed}>
          {resumedTo !== null
            ? `Resumed at ${formatPosition(resumedTo)}.`
            : `You stopped at ${formatPosition(resumeFrom)} last time — this picks up there.`}{" "}
          <button
            type="button"
            className={styles.startOver}
            onClick={() => {
              const element = audio.current;
              clearPosition(track.lessonId);
              setResumeFrom(null);
              setResumedTo(null);
              applied.current = true;
              if (element) element.currentTime = 0;
            }}
          >
            Start over
          </button>
        </p>
      ) : null}
      <audio
        ref={audio}
        controls
        preload="metadata"
        src={track.audioUrl}
        aria-label={`Play the audio lesson: ${title}`}
        onLoadedMetadata={() => {
          const element = audio.current;
          if (!element || applied.current || resumeFrom === null) return;
          // A saved position past the end of a re-encoded track would strand
          // the learner at the end of the file.
          if (Number.isFinite(element.duration) && resumeFrom >= element.duration) {
            clearPosition(track.lessonId);
            setResumeFrom(null);
            return;
          }
          element.currentTime = resumeFrom;
          applied.current = true;
          setResumedTo(resumeFrom);
        }}
        onTimeUpdate={() => {
          // Cheap throttle: the store does not need five writes a second.
          const element = audio.current;
          if (!element) return;
          if (Math.abs(element.currentTime - lastSaved.current) < 5) return;
          persist();
        }}
        onPause={persist}
        onSeeked={persist}
        onEnded={() => {
          clearPosition(track.lessonId);
          setResumeFrom(null);
          setResumedTo(null);
          setHeard(markListened(track.lessonId));
        }}
        className={styles.audio}
      />
      <p><a href={track.audioUrl} download>Save audio for offline listening</a></p>
      <details className={styles.transcript}>
        <summary>Read along (transcript)</summary>
        {track.sections.map((s) => (
          <div key={s.heading}>
            <h3>{s.heading}</h3>
            <p>{s.teacher}</p>
            {s.target ? (
              <p>
                <strong lang={langCodeFor(track.courseSlug)}>{s.target.text}</strong> — {s.target.meaning}
              </p>
            ) : null}
          </div>
        ))}
      </details>
    </section>
  );
}
