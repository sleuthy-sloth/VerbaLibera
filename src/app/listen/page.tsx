"use client";
import { useEffect, useMemo, useState } from "react";
import catalog from "@/features/course-pack/catalog.json";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import { tracksForCourse, type ListenTrack } from "@/features/listen/tracks";
import { listenedAt } from "@/features/listen/listened";
import { ListenPlayer } from "@/components/listen/ListenPlayer";
import styles from "./listen.module.css";

type LessonRow = { id: string; title: string };
const COURSE_KEY = "verbalibera_listen_course";

// Audio-only path: pick a lesson, press play, put the phone away.
//
// This page used to list every lesson in the pack and mark all but one
// "Audio being authored" — twenty-four rows of unavailability in a row. It now
// lists what actually exists to listen to, and says once, honestly, that more
// is coming.
export default function ListenPage() {
  const [course, setCourse] = useState("french");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const saved = window.localStorage.getItem(COURSE_KEY);
        const initial = params.get("course") ?? saved ?? "french";
        if (catalog.some((c) => c.slug === initial)) setCourse(initial);
        const lesson = params.get("lesson") ?? "";
        if (lesson) setSelected(lesson);
      } catch {
        // Defaults stand.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    let active = true;
    fetch(`/packs/${course}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Course pack is not downloaded yet.");
        return r.json();
      })
      .then((pack) => (normalizePack(pack) as { lessons: LessonRow[] }).lessons)
      .then((rows) => {
        if (!active) return;
        setError("");
        setLessons(rows.map((l) => ({ id: l.id, title: l.title })));
        try {
          window.localStorage.setItem(COURSE_KEY, course);
        } catch {}
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Could not open the course.");
          setLessons([]);
        }
      });
    return () => {
      active = false;
    };
  }, [course]);
  const track = selected ? tracksForCourse(course).find((t) => t.lessonId === selected) : undefined;
  const courseTitle = catalog.find((c) => c.slug === course)?.title ?? course;
  const lessonTitle = lessons.find((l) => l.id === selected)?.title;

  // Only lessons that actually have a track, newest-shaped first.
  const available = useMemo(() => {
    const titles = new Map(lessons.map((l) => [l.id, l.title]));
    return tracksForCourse(course)
      // Wait for the pack so every button carries the lesson's own title. The
      // track's internal label ("French Identity Foundations") is not what the
      // learner saw in the course, and rendering it first meant a button
      // appeared under the wrong name before the pack resolved.
      .filter((t: ListenTrack) => titles.has(t.lessonId))
      .map((t: ListenTrack) => ({ ...t, title: titles.get(t.lessonId)! }));
  }, [lessons, course]);
  const missingCount = Math.max(0, lessons.length - available.length);

  return (
    <main id="main-content" className={styles.page}>
      <p className={styles.eyebrow}>Audio lessons</p>
      <h1>Listen</h1>
      <p className={styles.lede}>
        A teacher talks you through each lesson by ear. Predict each answer out loud before the
        reveal — no typing, no scoring. Around ten minutes each.
      </p>
      <label className={styles.label}>
        Course
        <select value={course} onChange={(e) => { setCourse(e.target.value); setSelected(""); setError(""); }}>
          {catalog.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title}</option>
          ))}
        </select>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {track ? (
        <>
          <button onClick={() => setSelected("")} className={styles.back}>
            <span aria-hidden="true">←</span> All audio lessons
          </button>
          <ListenPlayer track={track} courseTitle={courseTitle} lessonTitle={lessonTitle} />
        </>
      ) : available.length === 0 ? (
        <p className={styles.empty}>
          {courseTitle} has no recorded lesson yet. The written course is ready — see the{" "}
          <a href={`/courses/${course}`}>{courseTitle.replace(/ foundations$/, "")} course</a>.
        </p>
      ) : (
        <>
          <ol className={styles.list}>
            {available.map((t) => {
              const heard = listenedAt(t.lessonId);
              return (
                <li key={t.lessonId}>
                  {/* The button's accessible name is the lesson title alone —
                      metadata belongs beside a control, not inside its name. */}
                  <button onClick={() => setSelected(t.lessonId)}>{t.title}</button>
                  <span className={styles.itemMeta}>
                    {Math.round(t.durationS / 60)} min
                    {t.reviewPending ? " · pronunciation check pending" : ""} ·{" "}
                    <span className={styles.itemState}>{heard ? "Listened" : "New"}</span>
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
      )}
    </main>
  );
}
