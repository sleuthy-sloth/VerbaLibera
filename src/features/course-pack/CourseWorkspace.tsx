"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Also bundled outside Next for offline cold starts. */
/* Public offline entry shares this component. Keep Next/account imports out. */
import catalog from "./catalog.json";
import { useEffect, useState, type ReactNode } from "react";
import type { CoursePack, Lesson } from "./schema";
import {
  conceptEvidence,
  completedLessons,
  projectProgress,
  selectDaily,
  mergeEvents,
  type PracticeEvent,
} from "./progress";
import { decodeBackup } from "./storage";
import { DialogueView } from "./DialogueView";
import { ExerciseView } from "./ExerciseView";
import type { Evaluation } from "./answer";
import type { CourseEnvironment } from "./environment";

type View = "Course" | "Vocabulary" | "Grammar" | "Review" | "Dialogues";
// Per-language Quiet Ink banners. Plain <img>: this component is also bundled
// outside Next for offline cold starts, so next/image is unavailable here.
const BANNER_BY_LANGUAGE: Record<string, string> = {
  french: "/brand/courses/french.jpg",
  italian: "/brand/courses/italian.jpg",
  spanish: "/brand/courses/spanish.jpg",
  portuguese: "/brand/courses/portuguese.jpg",
};
export type CourseWorkspaceProps = {
  initialLanguage?: string;
  environment: CourseEnvironment;
  scope?: string | null;
  synchronize?: (scope: string, signal?: AbortSignal) => Promise<PracticeEvent[]>;
  renderAccountPractice?: (props: {
    status: string;
    retry: () => void;
  }) => ReactNode;
};

export function CourseWorkspace({
  initialLanguage = "italian",
  environment,
  scope = null,
  synchronize,
  renderAccountPractice,
}: CourseWorkspaceProps) {
  return <ScopedWorkspace initialLanguage={initialLanguage} scope={scope} environment={environment} synchronize={synchronize} renderAccountPractice={renderAccountPractice} />;
}
function ScopedWorkspace({ initialLanguage, scope, environment, synchronize, renderAccountPractice }: {
  initialLanguage: string; scope: string | null; environment: CourseEnvironment; synchronize?: CourseWorkspaceProps["synchronize"]; renderAccountPractice?: CourseWorkspaceProps["renderAccountPractice"];
}) {
  const [syncRevision, setSyncRevision] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [language, setLanguage] = useState(initialLanguage),
    [pack, setPack] = useState<CoursePack | null>(null),
    [events, setEvents] = useState<PracticeEvent[]>([]),
    [view, setView] = useState<View>("Course");
  const [lessonId, setLessonId] = useState(""),
    [session, setSession] = useState<string[]>([]),
    [step, setStep] = useState(0),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [heard, setHeard] = useState<{ url: string; transcript: string } | null>(null),
    [minutes, setMinutes] = useState(10),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [downloaded, setDownloaded] = useState(false),
    [installing, setInstalling] = useState(false),
    [storageReady, setStorageReady] = useState(false);
  const [durability, setDurability] = useState(
    environment.practice.getDurability(),
  );
  const capabilities = environment.capabilities;
  useEffect(
    () => environment.practice.subscribeDurability(setDurability),
    [environment],
  );
  useEffect(() => {
    let active = true;
    Promise.all([
      environment.loadPack(language),
      environment.practice.read(scope)
        .then((events) => ({ events, error: null as string | null }))
        .catch((error) => ({
          events: [] as PracticeEvent[],
          error: String(error.message),
        })),
      environment.isInstalled?.(language).catch(() => false) ?? false,
    ])
      .then(([p, s, download]) => {
        if (active) {
          setPack(p);
          setEvents(s.events);
          if (s.error) setError(s.error + " You can still read the lessons.");
          setDownloaded(download);
          setStorageReady(!s.error);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [environment, language, scope]);
  useEffect(() => {
    if (!capabilities.synchronization || !scope || !storageReady) return;
    const controller = new AbortController();
    const run = async () => {
      if (!navigator.onLine) { setSyncStatus("Saved locally. Waiting for a connection to sync."); return; }
      setSyncStatus("Synchronizing account practice…");
      try {
        if (!synchronize) return;
        const synced = await synchronize(scope, controller.signal);
        if (!controller.signal.aborted) { setEvents(old => mergeEvents(old, synced)); setSyncStatus("Account practice synchronized."); }
      } catch (e) {
        if (!controller.signal.aborted) setSyncStatus(e instanceof Error ? e.message : "Sync failed. Local practice is safe.");
      }
    };
    const timer = setTimeout(run, 500);
    const reconnect = () => setSyncRevision(n => n + 1);
    window.addEventListener("online", reconnect);
    return () => { clearTimeout(timer); controller.abort(); window.removeEventListener("online", reconnect); };
  }, [capabilities.synchronization, scope, storageReady, syncRevision, synchronize]);
  useEffect(() => {
    if (lessonId && !session.length)
      document.querySelector<HTMLElement>(".study-lesson h2")?.focus();
  }, [lessonId, session]);
  const changeLanguage = (next: string) => {
    if (capabilities.hostedNavigation) {
      history.replaceState(
        null,
        "",
        location.pathname === "/study.html"
          ? `/study.html?language=${next}`
          : `/courses/${next}`,
      );
    }
    setPack(null);
    setStorageReady(false);
    setLanguage(next);
    setLessonId("");
    setSession([]);
    setStep(0);
    setHeard(null);
    setView("Course");
    setMessage("");
    setError("");
    setQuery("");
  };
  if (!pack)
    return (
      <main id="main-content" className="study">
        <h1>VerbaLibera foundations</h1>
        <p>{error || "Opening your course…"}</p>
        {error ? (
          <button onClick={() => location.reload()}>Try again</button>
        ) : null}
        {capabilities.hostedNavigation ? <a href="/dashboard">Daily path</a> : null}
      </main>
    );
  if (pack.status === "coming-soon")
    // Announced but unauthored: show the honest placeholder instead of an
    // empty workspace. Lessons appear here as units land.
    return (
      <main id="main-content" className="study">
        <p className="study-eyebrow">VerbaLibera · A1 course packs</p>
        <h1>{pack.title}</h1>
        <p className="study-lede">{pack.description}</p>
        <p>
          {pack.title.replace(/ foundations$/, "")} lessons are being authored
          now — this page fills in as units land. Meanwhile,{" "}
          {capabilities.hostedNavigation ? <><a href="/courses/french">French foundations</a> and{" "}<a href="/courses/italian">Italian foundations</a></> : <>French and Italian foundations</>} are ready to study.
        </p>
        {capabilities.hostedNavigation ? <a href="/dashboard">← Daily path</a> : null}
      </main>
    );
  const summary = conceptEvidence(pack, events);
  const progress = projectProgress(pack, events),
    completed = completedLessons(pack, events),
    lesson = pack.lessons.find((l) => l.id === lessonId);
  const allExercises = pack.lessons.flatMap((l) => l.exercises),
    activeExercise = allExercises.find((e) => e.id === session[step]);
  const count = events.filter((e) => e.packId === pack.id).length;
  const go = (next: View) => {
    window.scrollTo({ top: 0 });
    setView(next);
    setLessonId("");
    setSession([]);
    setStep(0);
    setHeard(null);
    setMessage("");
  };
  const begin = (l: Lesson) => {
    setSession(l.exercises.filter(e => !l.optionalExerciseIds.includes(e.id)).map((e) => e.id));
    setStep(0);
    setMessage("");
    // Hear-it-first: autoplay the lesson model inside the click gesture so
    // the learner hears the pattern before meeting any words. Browsers allow
    // playback here (transient activation); if blocked, play() rejects and
    // the manual Model audio player above remains the fallback.
    const model = pack.media.find((m) =>
      l.exercises.some((e) => e.kind === "dictation" && e.audioId === m.id),
    );
    if (model) void new Audio(environment.resolveMedia(model.url)).play().catch(() => {});
    // Remember what just played so the first practice step can name it and
    // offer a replay: otherwise the learner hears a sentence, then faces a
    // multiple-choice question with no idea the two are connected.
    setHeard(model ? { url: environment.resolveMedia(model.url), transcript: model.transcript } : null);
  };
  const save = async (result: Evaluation, revealed: boolean) => {
    if (!activeExercise) return;
    const event: PracticeEvent = {
      id: crypto.randomUUID(),
      packId: pack.id,
      version: pack.version,
      exerciseId: activeExercise.id,
      at: new Date().toISOString(),
      correct: result.accepted,
      revealed,
    };
    await environment.practice.write([event], scope);
    setEvents((old) => mergeEvents(old, [event]));
    setStep((old) => old + 1);
    if (scope) { setSyncStatus("Saved locally. Waiting to sync."); setSyncRevision(n => n + 1); }
  };
  const daily = selectDaily(pack, events, minutes);
  const reviewIds = daily.exerciseIds.filter((id) => !!progress[id]);
  const selectedState = (wordId: string) => {
    const related = allExercises
      .filter((e) => e.vocabulary.includes(wordId))
      .map((e) => progress[e.id])
      .filter(Boolean);
    if (!related.length) return "New";
    if (related.some((s) => s.dueAt <= new Date())) return "Due";
    if (related.some((s) => s.failures > s.successes)) return "Weak";
    if (related.some((s) => s.mode === "production" && s.repetitions >= 3))
      return "Strong";
    return "Learning";
  };
  return (
    <main id="main-content" className="study">
      <header className="study-header">
        {capabilities.hostedNavigation ? <a href="/dashboard">← Daily path</a> : null}
        <label>
          Foundation language
          <select
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
          >
            {catalog.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.title.replace(/ foundations$/, "")}
              </option>
            ))}
          </select>
        </label>
      </header>
      <p className="study-eyebrow">VerbaLibera · A1 course packs</p>
      <h1>{pack.title}</h1>
      {durability === "temporary" ? (
        <p role="alert">
          Progress is temporary in this browser. Export a backup before
          closing this file.
        </p>
      ) : null}
      {BANNER_BY_LANGUAGE[language] ? (
        <img className="course-banner" src={environment.resolveMedia(BANNER_BY_LANGUAGE[language])} alt="" />
      ) : null}
      <p className="study-lede">
        A little explanation. A worked example. Then make the language your own.
      </p>
      <p className="study-scope">
        {count} practice {count === 1 ? "result" : "results"} on this device ·{" "}
        {completed.size}/{pack.lessons.length} lessons practised successfully.
        {scope ? " Account practice is synchronized when connected." : " Device practice is separate from account progress."}
      </p>
      {capabilities.accounts && renderAccountPractice
        ? renderAccountPractice({
            status: syncStatus,
            retry: () => setSyncRevision((n) => n + 1),
          })
        : null}
      <nav className="study-tabs" aria-label="Course workspace">
        {(
          ["Course", "Review", "Vocabulary", "Grammar", "Dialogues"] as const
        ).map((tab) => (
          <button
            key={tab}
            aria-current={view === tab ? "page" : undefined}
            onClick={() => go(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {activeExercise ? (
        <>
          <p>
            Practice {step + 1} of {session.length}
          </p>
          {step === 0 && heard ? (
            <div className="study-listen-first">
              <p>
                <strong>Listen first.</strong> You just heard{" "}
                <span lang={pack.language}>«{heard.transcript}»</span> — that
                is the pattern this lesson teaches.
              </p>
              <audio
                controls
                preload="none"
                src={heard.url}
                aria-label="Replay the model sentence"
              />
              <p className="study-scope">
                Practice 1 below starts with one word from that sentence. Just
                listen and pick — nothing to memorize yet.
              </p>
            </div>
          ) : null}
          <ExerciseView
            key={`${activeExercise.id}:${step}`}
            exercise={activeExercise}
            pack={pack}
            onSave={save}
            resolveMedia={environment.resolveMedia}
          />
        </>
      ) : session.length > 0 ? (
        <section>
          <h2>Practice complete</h2>
          <p>
            Your results were saved on this device. Missed or revealed answers
            stay in review. A completed practice session is not a proficiency
            certificate.
          </p>
          <button onClick={() => go("Course")}>Back to course</button>
        </section>
      ) : view === "Course" ? (
        lesson ? (
          <section className="study-lesson">
            <button onClick={() => setLessonId("")}>← All lessons</button>
            <p className="study-eyebrow">Notice → build → vary → use</p>
            <h2 tabIndex={-1}>{lesson.title}</h2>
            <p>
              <strong>Your aim:</strong> {lesson.objective}
            </p>
            <p>{lesson.explanation}</p>
            <h3>Worked examples</h3>
            {lesson.examples.map((ex) => (
              <div className="study-example" key={ex.target}>
                <p lang={pack.language}>{ex.target}</p>
                <p>{ex.meaning}</p>
              </div>
            ))}
            <h3>Words and expressions</h3>
            <dl>
              {lesson.vocabulary
                .map((id) => pack.vocabulary.find((v) => v.id === id)!)
                .map((v) => (
                  <div key={v.id}>
                    <dt lang={pack.language}>{v.word}</dt>
                    <dd>{v.meaning}</dd>
                  </div>
                ))}
            </dl>
            {lesson.exercises.some((e) => e.kind === "dictation") ? (
              pack.media
                .filter((m) =>
                  lesson.exercises.some(
                    (e) => e.kind === "dictation" && e.audioId === m.id,
                  ),
                )
                .map((m) => (
                  <div key={m.id}>
                    <p>Model audio · normal speed</p>
                    <p lang={pack.language}>{m.transcript}</p>
                    <audio
                      controls
                      preload="none"
                      src={environment.resolveMedia(m.url)}
                      aria-label="Model audio"
                    />
                  </div>
                ))
            ) : (
              <p className="study-scope">
                This lesson is text-only. New recordings are still being
                authored.
              </p>
            )}
            <button
              className="study-primary"
              disabled={
                !storageReady ||
                !lesson.prerequisites.every((id) => completed.has(id))
              }
              onClick={() => begin(lesson)}
            >
              Begin practice
            </button>
            {lesson.optionalExerciseIds.length ? <>
              <button disabled={!storageReady || !lesson.prerequisites.every(id => completed.has(id))} onClick={() => { setSession(lesson.optionalExerciseIds); setStep(0); setHeard(null); setMessage(""); }}>Practice listening</button>
              <p className="study-scope">Listening is optional and has its own review history. New recordings do not reset completed text lessons.</p>
            </> : null}
            {!lesson.prerequisites.every((id) => completed.has(id)) ? (
              <p>
                Read freely. Complete the preceding lesson’s practice
                successfully to start this practice.
              </p>
            ) : null}
          </section>
        ) : (
          <>
            <section className="study-daily">
              <div>
                <p className="study-eyebrow">Your next step</p>
                <h2>
                  {pack.lessons.find((l) => l.id === daily.lessonId)?.title}
                </h2>
                <p>{daily.reason}</p>
              </div>
              <button
                className="study-primary"
                onClick={() => setLessonId(daily.lessonId)}
              >
                Open next lesson
              </button>
            </section>
            {pack.units.map((unit) => (
              <section key={unit.id}>
                <h2>{unit.title}</h2>
                <p>{unit.objective}</p>
                <ol className="study-lessons">
                  {pack.lessons
                    .filter((l) => l.unitId === unit.id)
                    .map((l) => (
                      <li key={l.id}>
                        <button onClick={() => setLessonId(l.id)}>
                          {l.title}
                        </button>
                        <span>
                          {completed.has(l.id)
                            ? "Practised"
                            : l.prerequisites.every((id) => completed.has(id))
                              ? "Ready"
                              : "Read ahead"}
                        </span>
                      </li>
                    ))}
                </ol>
              </section>
            ))}
          </>
        )
      ) : view === "Review" ? (
        <section>
          <h2>Today’s practice</h2>
          <label>
            Minutes per day
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
          <p>{daily.reason}</p>
          <p>
            {daily.exerciseIds.length} exercises. Recognition, production and
            listening have separate review histories.
          </p>
          <button
            className="study-primary"
            onClick={() => {
              setView("Course");
              setLessonId(daily.lessonId);
            }}
          >
            Study the lesson first
          </button>
          <button
            disabled={!reviewIds.length}
            onClick={() => {
              setSession(reviewIds);
              setStep(0);
            }}
          >
            Start mixed review
          </button>
          <p>For a new lesson, use its teaching and practice sequence first.</p>
        </section>
      ) : view === "Dialogues" ? (
        <section>
          <h2>Use it in a conversation</h2>
          <p>
            Original scripted conversations with recovery branches. Explore
            freely; choices here are not saved as mastery.
          </p>
          {pack.dialogues.map((d) => (
            <div key={d.id}>
              <p>
                Study first:{" "}
                {pack.lessons.find((l) => l.id === d.prerequisite)?.title}
              </p>
              <DialogueView dialogue={d} language={pack.language} />
            </div>
          ))}
        </section>
      ) : view === "Vocabulary" ? (
        <section>
          <h2>Your vocabulary</h2>
          <p>
            These labels summarize practice on exercises using the expression;
            they are not a precise test of each word.
          </p>
          <label>
            Search vocabulary
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            Practice status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {["All", "New", "Learning", "Weak", "Strong", "Due"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <div className="study-vocabulary">
            {pack.vocabulary
              .filter(
                (v) =>
                  (filter === "All" || selectedState(v.id) === filter) &&
                  `${v.word} ${v.meaning}`
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
              )
              .map((v) => (
                <article key={v.id}>
                  <h3 lang={pack.language}>{v.word}</h3>
                  <p>{v.meaning}</p>
                  <p lang={pack.language}>{v.example}</p>
                  <span>{selectedState(v.id)}</span>
                </article>
              ))}
          </div>
        </section>
      ) : (
        <section>
          <h2>Grammar reference</h2>
          {pack.concepts.map((c) => (
            <article key={c.id} className="study-grammar">
              <h3>{c.title}</h3>
              <p className="study-scope">
                {(["recognition", "production", "listening"] as const)
                  .map(
                    (mode) =>
                      `${mode}: ${summary[c.id][mode].successes} successful, ${summary[c.id][mode].failures} missed recalls`,
                  )
                  .join(" · ")}
              </p>
              <p>{c.explanation}</p>
              {c.examples.map((e) => (
                <p key={e.target}>
                  <strong lang={pack.language}>{e.target}</strong> — {e.meaning}
                </p>
              ))}
              <p>
                <strong>Watch for:</strong> {c.commonError}
              </p>
              <button
                onClick={() => {
                  setView("Course");
                  setLessonId(
                    pack.lessons.find((l) => l.conceptIds.includes(c.id))!.id,
                  );
                }}
              >
                Study this pattern
              </button>
            </article>
          ))}
        </section>
      )}
      <footer className="study-storage">
        <h2>{capabilities.offlineInstall ? "Keep learning offline" : "Keep a practice backup"}</h2>
        {capabilities.offlineInstall ? <p>
          Download this course’s text, practice tools and available audio.
          Guest practice stays in this browser. Selected account practice syncs
          when connected. Clearing browser data removes unsynchronized practice; keep a backup.
        </p> : <p>Practice stays in this browser. Export a backup so you can restore it later.</p>}
        <div className="study-actions">
          {capabilities.offlineInstall ? <button
            disabled={installing}
            onClick={async () => {
              setInstalling(true);
              setMessage("");
              try {
                if (!environment.install) throw new Error("Offline installation is unavailable.");
                await environment.install(pack, language);
                setDownloaded(true);
                setMessage(
                  "Downloaded. You can open offline study without a connection.",
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Download failed.");
              } finally {
                setInstalling(false);
              }
            }}
          >
            {installing ? "Downloading…" : "Download for offline study"}
          </button> : null}
          {capabilities.offlineInstall && downloaded ? (
            <a href={`/study.html?language=${language}`}>Open offline study</a>
          ) : null}
          <button
            onClick={async () => {
              try {
                const all = await environment.practice.read(scope),
                  url = URL.createObjectURL(
                    new Blob(
                      [JSON.stringify({ format: 1, events: all }, null, 2)],
                      { type: "application/json" },
                    ),
                  );
                const a = document.createElement("a");
                a.href = url;
                a.download = "verbalibera-practice.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Export practice backup
          </button>
          <label className="study-import">
            Import practice backup
            <input
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const incoming = decodeBackup(await file.text());
                  await environment.practice.write(incoming, scope);
                  setEvents(await environment.practice.read(scope));
                  setSyncRevision(n => n + 1);
                  setMessage(
                    "Backup merged. Duplicate practice was counted once.",
                  );
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Import failed.",
                  );
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="study-scope">
          {pack.description} {pack.attribution}
        </p>
      </footer>
    </main>
  );
}
