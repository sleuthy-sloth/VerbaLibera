"use client";
import { useEffect, useState } from "react";
import catalog from "@/features/course-pack/catalog.json";
import { validatePack } from "@/features/course-pack/schema";
import { trackForLesson } from "@/features/listen/tracks";
import { listenedAt } from "@/features/listen/listened";
import { ListenPlayer } from "@/components/listen/ListenPlayer";
import styles from "./listen.module.css";

type LessonRow = { id: string; title: string };
const COURSE_KEY = "verbalibera_listen_course";

// Audio-only path: pick a lesson, press play, put the phone away. Lessons
// without a track yet say so honestly instead of showing a dead player.
export default function ListenPage() {
  const [course, setCourse] = useState("french");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
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
  }, []);
  useEffect(() => {
    let active = true;
    setError("");
    fetch(`/packs/${course}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Course pack is not downloaded yet.");
        return r.json();
      })
      .then(validatePack)
      .then((pack) => {
        if (!active) return;
        setLessons(pack.lessons.map((l) => ({ id: l.id, title: l.title })));
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
  const track = selected ? trackForLesson(selected) : undefined;
  const courseTitle = catalog.find((c) => c.slug === course)?.title ?? course;
  return (
    <main id="main-content" className={styles.page}>
      <p className={styles.eyebrow}>VerbaLibera · audio lessons</p>
      <h1>Listen</h1>
      <p className={styles.lede}>
        A teacher guides each lesson by ear: predict answers aloud, then hear
        the reveal. Made for walks — download the course once, then press play
        and put the phone away.
      </p>
      <label className={styles.label}>
        Course
        <select value={course} onChange={(e) => { setCourse(e.target.value); setSelected(""); }}>
          {catalog.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title}</option>
          ))}
        </select>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {track ? (
        <>
          <button onClick={() => setSelected("")} className={styles.back}>← All audio lessons</button>
          <ListenPlayer track={track} courseTitle={courseTitle} />
        </>
      ) : (
        <ol className={styles.list}>
          {lessons.map((l) => {
            const has = !!trackForLesson(l.id);
            const heard = listenedAt(l.id);
            return (
              <li key={l.id}>
                {has ? (
                  <button onClick={() => setSelected(l.id)}>{l.title}</button>
                ) : (
                  <span>{l.title}</span>
                )}
                <span>{has ? (heard ? "Listened" : "Ready") : "Audio being authored"}</span>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
