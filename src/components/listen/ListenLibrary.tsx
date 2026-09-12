"use client";

import { useState, type ReactNode } from "react";
import type { ListenTrack } from "@/features/listen/tracks";
import { bannerFor } from "@/features/course-pack/banners";
import { listenedAt } from "@/features/listen/listened";
import { ListenPlayer } from "./ListenPlayer";
import styles from "./listen-library.module.css";

/**
 * The audio-lesson library: what a learner can listen to in one course, and the
 * player for the one they pick.
 *
 * Extracted so the three editions that offer Listen — the hosted tab, the
 * downloaded `/study.html` edition, and the portable single file — render the
 * same list, the same honest empty state, and the same player. It takes the
 * tracks and the lesson titles as data and never loads anything itself: an
 * edition supplies the titles through whatever it already has (a fetch served by
 * the service worker, or a pack embedded in the file), and supplies a resolver
 * when its audio is not at the plain path.
 */
export type ListenListItem = ListenTrack & {
  /** The lesson's title from the pack, which is what the learner saw. */
  title: string;
  /**
   * Why this track cannot play here, or null when it can. The portable edition
   * uses it when a file was built without the audio.
   */
  unavailable?: string | null;
};

export function ListenLibrary({
  courseTitle,
  tracks,
  missingCount,
  emptyState,
  resolveAudioSrc,
  initialLessonId = "",
}: {
  /** The course's own title — the player's album on the lock screen. */
  courseTitle: string;
  tracks: readonly ListenListItem[];
  /** Lessons in the pack with no recording yet. */
  missingCount: number;
  /** Rendered instead of the list when the course has no track at all. */
  emptyState: ReactNode;
  /** Portable editions rewrite the path to an embedded blob URL. */
  resolveAudioSrc?: (url: string) => string;
  /** A deep link into one track ("/listen?lesson=…"), if there is one. */
  initialLessonId?: string;
}) {
  const [selected, setSelected] = useState(initialLessonId);
  const track = tracks.find((candidate) => candidate.lessonId === selected);
  // The lock-screen artwork: the course banner, resolved through the same
  // resolver the audio uses so the portable edition hands back its embedded blob.
  const coverFor = (slug: string): string | undefined => {
    const banner = bannerFor(slug);
    if (!banner) return undefined;
    return resolveAudioSrc ? resolveAudioSrc(banner) : banner;
  };

  if (track) {
    return (
      <>
        <button onClick={() => setSelected("")} className={styles.back}>
          <span aria-hidden="true">←</span> All audio lessons
        </button>
        {track.unavailable ? (
          <p className={styles.note} role="status">
            {track.unavailable}
          </p>
        ) : (
          <ListenPlayer
            track={
              resolveAudioSrc
                ? { ...track, audioUrl: resolveAudioSrc(track.audioUrl) }
                : track
            }
            courseTitle={courseTitle}
            lessonTitle={track.title}
            coverUrl={coverFor(track.courseSlug)}
            resolveMedia={resolveAudioSrc}
          />
        )}
      </>
    );
  }

  if (tracks.length === 0) return <>{emptyState}</>;

  return (
    <>
      <ol className={styles.list}>
        {tracks.map((item) => {
          const heard = listenedAt(item.lessonId);
          return (
            <li key={item.lessonId}>
              {/* The button's accessible name is the lesson title alone —
                  metadata belongs beside a control, not inside its name. */}
              <button onClick={() => setSelected(item.lessonId)}>{item.title}</button>
              <span className={styles.itemMeta}>
                {Math.round(item.durationS / 60)} min
                {item.reviewPending ? " · pronunciation check pending" : ""} ·{" "}
                <span className={styles.itemState}>{heard ? "Listened" : "New"}</span>
                {item.unavailable ? (
                  <>
                    {" "}
                    · <span className={styles.itemState}>Not in this file</span>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {missingCount > 0 ? (
        <p className={styles.note}>
          {missingCount} more {missingCount === 1 ? "lesson is" : "lessons are"} being recorded.
          They appear here as they land.
        </p>
      ) : null}
    </>
  );
}
