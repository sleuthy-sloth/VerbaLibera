"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { tracksForCourse, type ListenTrack } from "@/features/listen/tracks";
import { ListenLibrary, type ListenListItem } from "./ListenLibrary";
import { formatBytes, listenBytesFor } from "@/features/listen/catalog";
import styles from "./listen-library.module.css";

/**
 * Listen, for the editions that are not the hosted app.
 *
 * The hosted `/listen` tab loads a pack over the network and uses Next's
 * routing; the downloaded `/study.html` edition and the portable single file
 * cannot. Both of those, though, already have a way to read a course — the
 * service-worker cache, and the pack embedded in the file — so this view takes
 * that reader as a prop and does the rest the same way everywhere:
 *
 *   - the catalog comes from `src/features/listen/generated/*.json`, which is
 *     built into every edition, so the list is never empty because a fetch
 *     failed;
 *   - lesson titles come from the pack the edition can already read, because the
 *     track's own internal label is not what the learner saw in the course;
 *   - a track the edition cannot play says so, instead of rendering a player
 *     that will fail silently (the portable file is built without the audio
 *     unless it is asked for it).
 *
 * Nothing here depends on lesson unlocks: Listen is a separate way into the
 * language, and a locked lesson must not lock its audio.
 */
export function ListenView({
  courseSlug,
  courseTitle,
  /** Reads one course pack, however this edition stores it. */
  readCourse,
  /** Rewrites a track's path when the audio is not at its plain URL. */
  resolveAudioSrc,
  /** Why a track is unplayable in this edition, or null when it is playable. */
  unavailableFor,
  courseHref,
  initialLessonId,
  heading,
  children,
}: {
  courseSlug: string;
  courseTitle: string;
  readCourse: (slug: string) => Promise<{ lessons: ReadonlyArray<{ id: string; title: string }> }>;
  resolveAudioSrc?: (url: string) => string;
  unavailableFor?: (track: ListenTrack) => string | null;
  courseHref?: string;
  /** Deep link to one track, carried through to the library. */
  initialLessonId?: string;
  /**
   * The heading above the list. Left out, the view renders its own `Listen`;
   * passed `null`, it renders none — the hosted tab already has an `<h1>` for
   * the page, and two identical headings is one too many.
   */
  heading?: ReactNode;
  /** Extra copy above the list — the size of the audio, an offline notice. */
  children?: ReactNode;
}) {
  // Results are tagged with the course they belong to rather than cleared when
  // the course changes, so nothing is set during render and there is no blank
  // frame between one course and the next.
  const [loaded, setLoaded] = useState<{
    course: string;
    titles: Record<string, string>;
  } | null>(null);
  const [failed, setFailed] = useState<{ course: string; message: string } | null>(null);

  // Held in a ref so an inline `readCourse` prop cannot restart the load on
  // every render — the effect below is keyed to the course, not the closure.
  const readCourseRef = useRef(readCourse);
  useEffect(() => {
    readCourseRef.current = readCourse;
  });

  useEffect(() => {
    let active = true;
    readCourseRef
      .current(courseSlug)
      .then((pack) => {
        if (!active) return;
        setLoaded({
          course: courseSlug,
          titles: Object.fromEntries(pack.lessons.map((lesson) => [lesson.id, lesson.title])),
        });
        setFailed(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setFailed({
          course: courseSlug,
          message: reason instanceof Error ? reason.message : "Could not open the course.",
        });
      });
    return () => {
      active = false;
    };
  }, [courseSlug]);

  const titles = loaded?.course === courseSlug ? loaded.titles : null;
  const error = failed?.course === courseSlug ? failed.message : "";

  const courseTracks = useMemo(() => tracksForCourse(courseSlug), [courseSlug]);
  const listItems: ListenListItem[] = useMemo(
    () =>
      titles
        ? courseTracks
            // A track whose lesson is not in the pack is not listable: there is
            // no title the learner would recognise.
            .filter((track) => titles[track.lessonId] !== undefined)
            .map((track) => ({
              ...track,
              title: titles[track.lessonId],
              unavailable: unavailableFor?.(track) ?? null,
            }))
        : [],
    [courseTracks, titles, unavailableFor],
  );

  const lessonCount = titles ? Object.keys(titles).length : 0;
  const missingCount = Math.max(0, lessonCount - listItems.length);
  const audioBytes = listenBytesFor(courseSlug);

  return (
    <section aria-label="Listen" className={styles.view}>
      {heading === null ? null : (heading ?? <h2 className={styles.heading}>Listen</h2>)}
      <p className={styles.lede}>
        A teacher talks you through each lesson by ear. Predict each answer out loud before the
        reveal — no typing, no scoring. Around ten minutes each.
        {audioBytes > 0 ? ` ${formatBytes(audioBytes)} of audio.` : ""}
      </p>
      {children}
      {error ? <p role="alert">{error}</p> : null}
      {!error && !titles ? <p className={styles.note}>Opening the course…</p> : null}
      {!error && titles ? (
        <ListenLibrary
          courseTitle={courseTitle}
          tracks={listItems}
          missingCount={missingCount}
          resolveAudioSrc={resolveAudioSrc}
          initialLessonId={initialLessonId}
          emptyState={
            <p className={styles.empty}>
              {courseTitle} has no recorded lesson yet. The written course is ready
              {courseHref ? (
                <>
                  {" "}
                  — see the <a href={courseHref}>{courseTitle.replace(/ foundations$/, "")} course</a>
                </>
              ) : null}
              .
            </p>
          }
        />
      ) : null}
    </section>
  );
}
