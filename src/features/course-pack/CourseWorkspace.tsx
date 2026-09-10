"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Also bundled outside Next for offline cold starts. */
/* Public offline entry shares this component. Keep Next/account imports out. */
import catalog from "./catalog.json";
import { OfflineDownload } from "./OfflineDownload";
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
import type { RuntimePack } from "./lesson-runtime";
import { RuntimeCourseWorkspace } from "./RuntimeCourseWorkspace";
import { decodeBackup } from "./storage";
import { DialogueView } from "./DialogueView";
import { ExerciseView } from "./ExerciseView";
import type { Evaluation } from "./answer";
import { producesTargetLanguage } from "./feedback";
import type { CourseEnvironment } from "./environment";

/** Workspace views. Also the `/courses/<language>/<view>` URL segment values. */
export type WorkspaceView = "Course" | "Vocabulary" | "Grammar" | "Review" | "Dialogues";
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
  startNextLesson?: boolean;
  /** Which workspace view to open: course (default), review, vocabulary, grammar, dialogues. */
  initialView?: WorkspaceView;
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
  startNextLesson = false,
  initialView,
  environment,
  scope = null,
  synchronize,
  renderAccountPractice,
}: CourseWorkspaceProps) {
  return <ScopedWorkspace startNextLesson={startNextLesson} initialLanguage={initialLanguage} initialView={initialView} scope={scope} environment={environment} synchronize={synchronize} renderAccountPractice={renderAccountPractice} />;
}
function ScopedWorkspace({ initialLanguage, startNextLesson, initialView, scope, environment, synchronize, renderAccountPractice }: {
  initialLanguage: string; startNextLesson: boolean; initialView?: WorkspaceView; scope: string | null; environment: CourseEnvironment; synchronize?: CourseWorkspaceProps["synchronize"]; renderAccountPractice?: CourseWorkspaceProps["renderAccountPractice"];
}) {
  const [syncRevision, setSyncRevision] = useState(0);
  const [runtimePack, setRuntimePack] = useState<RuntimePack | null>(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [language, setLanguage] = useState(initialLanguage),
    [pack, setPack] = useState<CoursePack | null>(null),
    [events, setEvents] = useState<PracticeEvent[]>([]),
    [view, setView] = useState<WorkspaceView>(initialView ?? "Course");
  const [lessonId, setLessonId] = useState(""),
    [session, setSession] = useState<string[]>([]),
    [step, setStep] = useState(0),
    // Every target-language form the learner got credit for this session, in
    // order. Visible accumulation: the one progress signal a lesson had was
    // "Practice 3 of 7", which shows effort but never progress.
    [usedPhrases, setUsedPhrases] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [heard, setHeard] = useState<{ url: string; transcript: string } | null>(null),
    [minutes, setMinutes] = useState(10),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
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
      environment.loadCourse ? environment.loadCourse(language) : environment.loadPack(language),
      environment.practice.read(scope)
        .then((events) => ({ events, error: null as string | null }))
        .catch((error) => ({
          events: [] as PracticeEvent[],
          error: String(error.message),
        })),
    ])
      .then(([p, s]) => {
        if (active) {
          if ("activities" in p) {
            setRuntimePack(p);
            setStorageReady(!s.error);
            if (s.error) setError(s.error);
            return;
          }
          setPack(p);
          setEvents(s.events);
          if (s.error) setError(s.error + " You can still read the lessons.");
          if (startNextLesson && p.lessons.length) setLessonId(selectDaily(p, s.events, 10).lessonId);
          if (capabilities.hostedNavigation) {
            try { localStorage.setItem("verbalibera_course", `english-to-${language}`); } catch {}
          }
          setStorageReady(!s.error);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [environment, language, scope, startNextLesson, capabilities.hostedNavigation]);
  useEffect(() => {
    if (!capabilities.synchronization || !scope || !storageReady) return;
    const controller = new AbortController();
    const run = async () => {
      if (!navigator.onLine) { setSyncStatus("Saved locally. Waiting for a connection to sync."); return; }
      setSyncStatus("Synchronizing account practice…");
      try {
        if (!synchronize) return;
        const synced = await synchronize(scope, controller.signal);
        if (!controller.signal.aborted) { setEvents(old => mergeEvents(old, synced)); setSyncStatus("Practice synced."); }
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
    setRuntimePack(null);
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
  if (runtimePack) return <RuntimeCourseWorkspace key={`${runtimePack.id}:${scope ?? "guest"}`} pack={runtimePack} environment={environment} scope={scope} language={language} onLanguageChange={changeLanguage} onProgressChanged={() => setSyncRevision(n => n + 1)} accountControls={renderAccountPractice?.({status: syncStatus, retry: () => setSyncRevision(n => n + 1)})} startNextLesson={startNextLesson} />;
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
        {capabilities.hostedNavigation ? <a href="/dashboard"><span aria-hidden="true">←</span> Daily path</a> : null}
      </main>
    );
  const summary = conceptEvidence(pack, events);
  const progress = projectProgress(pack, events),
    completed = completedLessons(pack, events),
    lesson = pack.lessons.find((l) => l.id === lessonId);
  const nextPathLesson = pack.lessons.find(
    (candidate) =>
      !completed.has(candidate.id) &&
      candidate.prerequisites.every((id) => completed.has(id)),
  );
  const allExercises = pack.lessons.flatMap((l) => l.exercises),
    activeExercise = allExercises.find((e) => e.id === session[step]);
  // Where to send the learner when the session ends: the next lesson in course
  // order, offered only when its prerequisites are met, so "Next" can never
  // open a locked lesson.
  const lessonIndex = lesson ? pack.lessons.indexOf(lesson) : -1;
  const nextLesson = lessonIndex >= 0 ? pack.lessons[lessonIndex + 1] : undefined;
  const nextUnlocked =
    !!nextLesson && nextLesson.prerequisites.every((id) => completed.has(id));
    const go = (next: WorkspaceView) => {
    window.scrollTo({ top: 0 });
    setView(next);
    setLessonId("");
    setSession([]);
    setStep(0);
    setUsedPhrases([]);
    setHeard(null);
    setMessage("");
  };
  const begin = (l: Lesson) => {
    setSession(l.exercises.filter(e => !l.optionalExerciseIds.includes(e.id)).map((e) => e.id));
    setStep(0);
    setUsedPhrases([]);
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
    if (result.accepted && producesTargetLanguage(activeExercise.kind) && result.model.trim())
      setUsedPhrases((old) =>
        old.includes(result.model) ? old : [...old, result.model],
      );
    setStep((old) => old + 1);
    if (scope) { setSyncStatus("Saved locally. Waiting to sync."); setSyncRevision(n => n + 1); }
  };
  const daily = selectDaily(pack, events, minutes);
  const reviewIds = daily.exerciseIds.filter((id) => !!progress[id]);

  // Lesson shell: when a lesson is open, render it alone. The course shell
  // (download panel, account controls, workspace tabs, practice backup) is for
  // browsing; a learner who has opened a lesson should see one lesson and one
  // way out. This is also what makes `?start=1` land somewhere deliberate
  // instead of scrolling a 3,000px page to a section below the chrome.
  const practising = !!activeExercise || session.length > 0;
  // Only the lesson *introduction* gets its own shell. Once practice starts the
  // session renders in the main return below (focused, chrome-free) — guarding
  // on `lesson` alone made "Begin practice" a no-op, because the intro shell
  // re-rendered instead of the exercise.
  if (lesson && !practising) {
    const lessonUnlocked = lesson.prerequisites.every((id) => completed.has(id));
    const modelClip = pack.media.find((m) =>
      lesson.exercises.some((e) => e.kind === "dictation" && e.audioId === m.id),
    );
    return (
      <main id="main-content" className="study study-focused">
        <button type="button" className="study-back" onClick={() => setLessonId("")}>
          <span aria-hidden="true">←</span> Back to the course
        </button>
        <p className="study-eyebrow">
          Lesson {pack.lessons.indexOf(lesson) + 1} of {pack.lessons.length} · Notice → build → vary → use
        </p>
        <h1>{lesson.title}</h1>
        <p>
          <strong>Your aim:</strong> {lesson.objective}
        </p>
        <p>{lesson.explanation}</p>
        <h2>Worked examples</h2>
        {lesson.examples.map((ex) => (
          <div className="study-example" key={ex.target}>
            <p lang={pack.language}>{ex.target}</p>
            <p>{ex.meaning}</p>
          </div>
        ))}
        <h2>Words and expressions</h2>
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
        {modelClip ? (
          <div>
            <h2>Hear it once</h2>
            <p lang={pack.language}>{modelClip.transcript}</p>
            <audio
              controls
              preload="none"
              src={environment.resolveMedia(modelClip.url)}
              aria-label="Model audio"
            />
          </div>
        ) : (
          <p className="study-scope">No recording for this lesson yet — read it aloud yourself.</p>
        )}
        <button className="study-primary study-primary-large" disabled={!storageReady || !lessonUnlocked} onClick={() => begin(lesson)}>
          Begin practice
        </button>
        {lesson.optionalExerciseIds.length ? (
          <>
            <button disabled={!storageReady || !lessonUnlocked} onClick={() => { setSession(lesson.optionalExerciseIds); setStep(0); setHeard(null); setMessage(""); }}>
              Practice listening
            </button>
            <p className="study-scope">Listening practice is optional.</p>
          </>
        ) : null}
        {!lessonUnlocked ? (
          <p className="study-scope">
            You can read this lesson now. Finish the practice in the lesson before it to unlock its
            exercises.
          </p>
        ) : null}
      </main>
    );
  }

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
    <main id="main-content" className={practising ? "study study-focused" : "study"}>
      {practising ? null : <header className="study-header">
        {capabilities.hostedNavigation ? <a href="/dashboard"><span aria-hidden="true">←</span> Today</a> : null}
        <label>
          Learning language
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
      </header>}
      {practising ? null : <h1>{pack.title}</h1>}
      {durability === "temporary" ? (
        <p role="alert">
          Progress is temporary in this browser. Export a backup before
          closing this file.
        </p>
      ) : null}
      {practising || !BANNER_BY_LANGUAGE[language] ? null : (
        <img className="course-banner" src={environment.resolveMedia(BANNER_BY_LANGUAGE[language])} alt="" />
      )}
      {practising ? null : <p className="study-lede">
        A little explanation. A worked example. Then make the language your own.
      </p>}
      {/* The storage-scope paragraph used to open this page with two sentences
          about which layer holds your progress. One compact line, and the long
          version lives on /you next to the action that changes it. */}
      {practising ? null : <p className="study-scope">
        {completed.size} of {pack.lessons.length} lessons practised
        {scope ? " · kept on your account" : " · kept in this browser"}
      </p>}
      {practising || !capabilities.accounts || !renderAccountPractice
        ? null
        : renderAccountPractice({
            status: syncStatus,
            retry: () => setSyncRevision((n) => n + 1),
          })}
      {practising || !capabilities.offlineInstall ? null : <OfflineDownload key={language} pack={pack} language={language} environment={environment} />}
      {practising ? null : <nav className="study-tabs" aria-label="Course sections">
        {(
          ["Course", "Review", "Vocabulary", "Grammar", "Dialogues"] as const
        ).map((tab) => (
          // Real destinations, not buttons: the selected view used to live only
          // in useState, so switching to Vocabulary and reloading dropped you
          // back on Course, and the view could not be linked or shared.
          capabilities.hostedNavigation ? (
            <a
              key={tab}
              href={`/courses/${language}${tab === "Course" ? "" : `/${tab.toLowerCase()}`}`}
              aria-current={view === tab ? "page" : undefined}
            >
              {tab}
            </a>
          ) : (
            <button
              key={tab}
              aria-current={view === tab ? "page" : undefined}
              onClick={() => go(tab)}
            >
              {tab}
            </button>
          )
        ))}
      </nav>}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {activeExercise ? (
        <>
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
          <div className="study-session-progress">
            <span>Practice {step + 1} of {session.length}</span>
            {/* `value={step}` showed an empty bar beside the label "Practice 1
                of 7" — the text and the bar disagreed. The bar counts the step
                you are on, so it matches the label. */}
            <progress aria-label="Practice progress" max={session.length} value={step + 1} />
          </div>
          {usedPhrases.length ? (
            <p className="study-used" aria-live="polite">
              <span className="study-used-label">Used this session</span>{" "}
              <span lang={pack.language}>{usedPhrases.join(" · ")}</span>
            </p>
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
        <section className="study-finished">
          <p className="study-eyebrow">Session finished</p>
          <h2>{lesson ? `${lesson.title} — done.` : "Practice complete"}</h2>
          {usedPhrases.length ? (
            <>
              <p>
                You used {usedPhrases.length}{" "}
                {usedPhrases.length === 1 ? "expression" : "expressions"} in{" "}
                {pack.title.replace(/ foundations$/, "")} just now:
              </p>
              <p className="study-finished-used" lang={pack.language}>
                {usedPhrases.join(" · ")}
              </p>
              <p className="study-scope">
                Say them out loud once more before you move on — that is the rep
                that counts.
              </p>
            </>
          ) : (
            <p>
              Nothing landed first time this round. That is why these come back
              sooner — work through them once more and they will stick.
            </p>
          )}
          <div className="study-actions">
            {nextLesson && nextUnlocked ? (
              <button
                className="study-primary"
                onClick={() => {
                  setSession([]);
                  setStep(0);
                  setUsedPhrases([]);
                  setHeard(null);
                  setMessage("");
                  setLessonId(nextLesson.id);
                }}
              >
                Next: {nextLesson.title}
              </button>
            ) : null}
            <button onClick={() => go("Course")}>Back to course</button>
          </div>
          <p className="study-scope">
            Saved on this device. Missed or revealed answers stay in review.
          </p>
        </section>
      ) : view === "Course" ? (
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
            <nav className="study-path" aria-label="Course path">
              <div className="study-path-heading">
                <div>
                  <p className="study-eyebrow">Your route</p>
                  <h2>Course path</h2>
                  <p>Start at the top. Revisit any completed lesson whenever you need it.</p>
                </div>
                <div className="study-path-progress">
                  <strong>{completed.size} of {pack.lessons.length}</strong>
                  <span>lessons practised</span>
                  <progress aria-label="Course progress" max={pack.lessons.length} value={completed.size} />
                </div>
              </div>
              {pack.units.map((unit) => (
                <section key={unit.id} className="study-path-unit">
                  <h3>{unit.title}</h3>
                  <p>{unit.objective}</p>
                  <ol className="study-lessons">
                    {pack.lessons.filter((l) => l.unitId === unit.id).map((l, index) => {
                      const isComplete = completed.has(l.id);
                      const isNext = nextPathLesson?.id === l.id;
                      const unlocked = l.prerequisites.every((id) => completed.has(id));
                      const prerequisite = pack.lessons.find((item) => item.id === l.prerequisites[0]);
                      const status = isComplete ? "Complete — select to review" : isNext ? "Up next — select to start" : unlocked ? "Ready — select to start" : `Locked — complete ${prerequisite?.title ?? "the preceding lesson"} to unlock`;
                      // `.is-locked` used to swallow the "Ready" state too, so
                      // available lessons looked disabled. State now maps 1:1.
                      const state = isComplete ? "is-complete" : isNext ? "is-next" : unlocked ? "is-ready" : "is-locked";
                      return <li key={l.id} className={state}>
                        <span className="study-path-number" aria-hidden="true">{index + 1}</span>
                        <button onClick={() => setLessonId(l.id)} disabled={!unlocked}>{l.title}</button>
                        <span className={state === "is-locked" ? "study-lock" : undefined}>
                          {state === "is-locked" ? <><span aria-hidden="true">🔒</span>{`After ${prerequisite?.title ?? "the previous lesson"}`}</> : status}
                        </span>
                      </li>;
                    })}
                  </ol>
                </section>
              ))}
            </nav>
          </>
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
      {practising ? null : (
      <footer className="study-storage">
        <h2>Keep a practice backup</h2>
        <p>Export your practice to restore it later or move it to another device. Guest and account practice stay separate.</p>
        <div className="study-actions">
          <button
            onClick={async () => {
              try {
                const backup = environment.backup
                  ? await environment.backup.export()
                  : { format: 1, events: await environment.practice.read(scope) };
                const url = URL.createObjectURL(
                    new Blob(
                      [JSON.stringify(backup, null, 2)],
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
                  const raw = await file.text();
                  if (environment.backup) await environment.backup.import(raw);
                  else await environment.practice.write(decodeBackup(raw), scope);
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
      )}
    </main>
  );
}
