"use client";
import { useEffect, useRef, useState } from "react";
import type { ListenTrack } from "@/features/listen/tracks";
import { langCodeFor } from "@/features/course-pack/language-code";
import { listenedAt, markListened } from "@/features/listen/listened";
import styles from "./listen-player.module.css";

// Audio-only lesson player. Lock-screen / control-center metadata comes from
// the Media Session API (guarded: jsdom and old browsers lack it). Finishing
// a track marks it listened — heard, not mastered.
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
  // The lesson the learner picked names the player. The track's own label
  // describes the recording, so it is only the fallback when the course has
  // not loaded yet.
  const title = lessonTitle ?? track.lessonTitle;
  useEffect(() => {
    const timer = setTimeout(() => setHeard(listenedAt(track.lessonId)), 0);
    return () => clearTimeout(timer);
  }, [track.lessonId]);
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
      <audio
        ref={audio}
        controls
        preload="none"
        src={track.audioUrl}
        aria-label={`Play the audio lesson: ${title}`}
        onEnded={() => setHeard(markListened(track.lessonId))}
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
