"use client";
import { useEffect, useState } from "react";
import catalog from "@/features/course-pack/catalog.json";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import { ListenView } from "@/components/listen/ListenView";
import styles from "./listen.module.css";

const COURSE_KEY = "verbalibera_listen_course";

// Audio-only path: pick a lesson, press play, put the phone away.
//
// The list, the empty state and the player now live in `ListenView`, which the
// downloaded `/study.html` edition and the portable single file render too — so
// the three editions cannot drift into three different Listen tabs. This page
// keeps what only it has: Next routing, the course picker, and the URL.
//
// It used to list every lesson in the pack and mark all but one "Audio being
// authored" — twenty-four rows of unavailability in a row. It lists what exists
// to listen to, and says once, honestly, how much is still being recorded.
export default function ListenPage() {
  const [course, setCourse] = useState("french");
  const [lesson, setLesson] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const saved = window.localStorage.getItem(COURSE_KEY);
        const initial = params.get("course") ?? saved ?? "french";
        if (catalog.some((c) => c.slug === initial)) setCourse(initial);
        setLesson(params.get("lesson") ?? "");
      } catch {
        // Defaults stand.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const courseTitle = catalog.find((c) => c.slug === course)?.title ?? course;

  return (
    <main id="main-content" className={styles.page}>
      <p className={styles.eyebrow}>Audio lessons</p>
      <h1>Listen</h1>
      <label className={styles.label}>
        Course
        <select
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            try {
              window.localStorage.setItem(COURSE_KEY, e.target.value);
            } catch {
              // Denied storage: the choice still applies to this visit.
            }
            setError("");
          }}
        >
          {catalog.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <ListenView
        courseSlug={course}
        courseTitle={courseTitle}
        courseHref={`/courses/${course}`}
        initialLessonId={lesson}
        // The page owns the `<h1>`; the view would duplicate it.
        heading={null}
        // The pack is fetched here (and served from the cache offline) rather
        // than passed in, which is what keeps this page a server-rendered shell.
        readCourse={(slug) =>
          fetch(`/packs/${slug}.json`)
            .then((response) => {
              if (!response.ok) throw new Error("Course pack is not downloaded yet.");
              return response.json();
            })
            .then((pack) => normalizePack(pack))
        }
      />
    </main>
  );
}
