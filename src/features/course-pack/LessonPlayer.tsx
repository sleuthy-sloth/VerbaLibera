"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./lesson-player.css";
import {
  advanceLesson,
  openSupport,
  startLesson,
  submitResponse,
  type LessonSession,
} from "./lesson-session";
import type {
  Assistance,
  DialogueStimulus,
  ExamplesStimulus,
  Family,
  MediaAsset,
  Response,
  RuntimeLesson,
  RuntimePack,
  SceneStimulus,
  Stimulus,
  TextStimulus,
} from "./lesson-runtime";
import {
  resumeSession,
  mergeLearningEvents,
  projectLessonEvidence,
  type ActivityAttempt,
  type LearningEvent,
  type LessonCheckpoint,
  type StepCompletion,
} from "./attempts";
import type { CourseEnvironment, PracticeDurability } from "./environment";
import { ActivityView } from "./activities/ActivityView";
import { StoryLayout } from "./layouts/StoryLayout";
import { ConversationLayout } from "./layouts/ConversationLayout";
import { ListeningLayout } from "./layouts/ListeningLayout";

/**
 * Lesson player shell (Wave B, plan Task 5/6): drives the pure session
 * engine, persists versioned learning events + checkpoints through
 * `environment.lessonPractice`, and renders family layouts with activity
 * components. Persistence is fail-closed: without a lesson practice store the
 * player refuses to start rather than silently dropping practice.
 */
export type LessonPlayerProps = {
  pack: RuntimePack;
  lessonId: string;
  environment: CourseEnvironment;
  onExit: () => void;
};

type PendingSave = {
  /** Events for the submitted attempt; regenerated ids only on re-check. */
  events: LearningEvent[];
  /** Engine state to commit once the events are durably written. */
  commitSession: LessonSession;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isAttemptEvent = (event: LearningEvent): event is ActivityAttempt =>
  "eventVersion" in event && event.type === "attempt";

/** Steps along the chosen branch path, entry → terminal (mirrors attempts.ts). */
const walkTrail = (
  lesson: RuntimeLesson,
  selectedBranches: Record<string, string>,
): string[] => {
  const steps = new Map(lesson.steps.map((s) => [s.id, s]));
  const trail: string[] = [];
  const seen = new Set<string>();
  let current: string | null = lesson.entryStepId;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    trail.push(current);
    const step = steps.get(current);
    if (!step) break;
    const branchKeys = Object.keys(step.branches ?? {});
    current =
      branchKeys.length > 0
        ? (step.branches![selectedBranches[current] ?? ""] ?? null)
        : step.nextStepId;
  }
  return trail;
};

const lastAttemptFor = (
  events: LearningEvent[],
  packId: string,
  lessonId: string,
  stepId: string,
  revision: number,
): ActivityAttempt | undefined =>
  events
    .filter(isAttemptEvent)
    .filter(
      (event) =>
        event.packId === packId &&
        event.lessonId === lessonId &&
        event.stepId === stepId &&
        event.lessonRevision === revision,
    )
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .at(-1);

const validResponse = (response: Response | null): boolean => {
  if (!response) return false;
  switch (response.kind) {
    case "text":
      return response.text.trim().length > 0;
    case "selection":
    case "ordering":
      return response.ids.length > 0;
    case "matching":
      return response.pairs.length > 0;
    case "cloze":
      return Object.values(response.values).some(
        (value) => value.trim().length > 0,
      );
    case "self":
    case "continue":
      return true;
  }
};

const outcomeWord = (outcome: string): string =>
  outcome === "correct"
    ? "That's it."
    : outcome === "incorrect"
      ? "Not quite — try again."
      : outcome === "self-assessed"
        ? "Thanks — that shapes what comes back next."
        : outcome === "blocked"
          ? "Not saved — check your connection and try again."
          : "Working on it…";

/* --------------------------------------------------------- stimulus context */

const stripPunctuation = (token: string): string =>
  token.replace(/[.,!?;:“”«»()]/g, "");

function TextContext({
  stimulus,
  vocabularyByWord,
  language,
  onAssist,
}: {
  stimulus: TextStimulus;
  vocabularyByWord: Map<string, { word: string; meaning: string }>;
  language: string;
  onAssist: (kind: Assistance) => void;
}) {
  const [translationShown, setTranslationShown] = useState(false);
  const [glosses, setGlosses] = useState<Array<{ word: string; meaning: string }>>([]);
  // Split with capture keeps whitespace tokens so spacing survives rendering.
  const parts = stimulus.body.split(/(\s+)/);
  return (
    <div>
      <p className="lp-story-text" lang={language}>
        {parts.map((part, index) => {
          if (index % 2 === 1 || !part) return part;
          const entry = vocabularyByWord.get(
            stripPunctuation(part).toLowerCase(),
          );
          if (!entry) return part;
          return (
            <button
              key={index}
              type="button"
              className="lp-gloss"
              aria-label={`Show meaning of ${entry.word}`}
              onClick={() => {
                setGlosses((prev) =>
                  prev.some((gloss) => gloss.word === entry.word)
                    ? prev
                    : [...prev, entry],
                );
                onAssist("translation");
              }}
            >
              {part}
            </button>
          );
        })}
      </p>
      {stimulus.translation && (
        <div className="lp-assist">
          {translationShown ? (
            <p className="lp-translation">{stimulus.translation}</p>
          ) : (
            <button
              type="button"
              className="lp-secondary"
              onClick={() => {
                setTranslationShown(true);
                onAssist("translation");
              }}
            >
              Show translation
            </button>
          )}
        </div>
      )}
      {glosses.length > 0 && (
        <ul className="lp-glosses">
          {glosses.map((gloss) => (
            <li key={gloss.word}>
              {gloss.word} — {gloss.meaning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DialogueContext({
  stimulus,
  language,
  onAssist,
}: {
  stimulus: DialogueStimulus;
  language: string;
  onAssist: (kind: Assistance) => void;
}) {
  const [meaningsShown, setMeaningsShown] = useState(false);
  const hasMeanings = stimulus.turns.some((turn) => turn.meaning);
  return (
    <div>
      <ul className="lp-thread">
        {stimulus.turns.map((turn, index) => (
          <li key={index} className="lp-turn">
            <span className="lp-speaker">{turn.speaker}</span>
            <p className="lp-turn-text" lang={language}>
              {turn.text}
            </p>
            {meaningsShown && turn.meaning && (
              <p className="lp-turn-meaning">{turn.meaning}</p>
            )}
          </li>
        ))}
      </ul>
      {hasMeanings && !meaningsShown && (
        <div className="lp-assist">
          <button
            type="button"
            className="lp-secondary"
            onClick={() => {
              setMeaningsShown(true);
              onAssist("translation");
            }}
          >
            Show meanings
          </button>
        </div>
      )}
    </div>
  );
}

function AudioContext({
  media,
  resolveSrc,
  language,
  onAssist,
  onAvailabilityChange,
}: {
  media: MediaAsset;
  resolveSrc: (url: string) => string;
  language: string;
  onAssist: (kind: Assistance) => void;
  onAvailabilityChange: (unavailable: boolean) => void;
}) {
  const [transcriptShown, setTranscriptShown] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  return (
    <div>
      {/* Deliberately no autoplay: playback always starts from this control. */}
      <audio
        ref={audioRef}
        onError={() => onAvailabilityChange(true)}
        onCanPlay={() => onAvailabilityChange(false)}
        className="lp-audio"
        controls
        preload="metadata"
        src={resolveSrc(media.url)}
        aria-label="Lesson audio"
      />
      <button type="button" className="lp-secondary" onClick={() => audioRef.current?.load()}>Retry audio</button>
      {media.transcript && (
        <div className="lp-assist">
          {transcriptShown ? (
            <p className="lp-transcript" lang={language}>
              {media.transcript}
            </p>
          ) : (
            <button
              type="button"
              className="lp-secondary"
              onClick={() => {
                setTranscriptShown(true);
                onAssist("transcript");
              }}
            >
              Show transcript
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SceneContext({
  stimulus,
  media,
  resolveSrc,
  onAssist,
}: {
  stimulus: SceneStimulus;
  media: MediaAsset;
  resolveSrc: (url: string) => string;
  onAssist: (kind: Assistance) => void;
}) {
  const [descriptionShown, setDescriptionShown] = useState(false);
  return (
    <div>
      <img
        className="lp-scene"
        src={resolveSrc(media.url)}
        alt={stimulus.alt}
      />
      {descriptionShown ? (
        <p className="lp-scene-alt">{stimulus.textAlternative}</p>
      ) : (
        <div className="lp-assist">
          <button
            type="button"
            className="lp-secondary"
            onClick={() => {
              setDescriptionShown(true);
              onAssist("translation");
            }}
          >
            Show description
          </button>
        </div>
      )}
    </div>
  );
}

function ExamplesContext({
  stimulus,
  language,
}: {
  stimulus: ExamplesStimulus;
  language: string;
}) {
  return (
    <dl className="lp-examples">
      {stimulus.pairs.map((pair) => (
        <div key={pair.target}>
          <dt lang={language}>{pair.target}</dt>
          <dd>{pair.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

type ContextProps = {
  onAudioAvailabilityChange: (unavailable: boolean) => void;
  language: string;
  vocabularyByWord: Map<string, { word: string; meaning: string }>;
  mediaById: Map<string, MediaAsset>;
  resolveSrc: (url: string) => string;
  onAssist: (kind: Assistance) => void;
};

function buildContext(stimulus: Stimulus, props: ContextProps): ReactNode {
  switch (stimulus.kind) {
    case "text":
      return (
        <TextContext
          stimulus={stimulus}
          vocabularyByWord={props.vocabularyByWord}
          language={props.language}
          onAssist={props.onAssist}
        />
      );
    case "dialogue":
      return (
        <DialogueContext
          stimulus={stimulus}
          language={props.language}
          onAssist={props.onAssist}
        />
      );
    case "audio": {
      const media = props.mediaById.get(stimulus.mediaId);
      if (!media || media.kind !== "audio") return null;
      return (
        <AudioContext
          onAvailabilityChange={props.onAudioAvailabilityChange}
          media={media}
          resolveSrc={props.resolveSrc}
          language={props.language}
          onAssist={props.onAssist}
        />
      );
    }
    case "scene": {
      const media = props.mediaById.get(stimulus.mediaId);
      if (!media || media.kind !== "image") {
        return <p className="lp-scene-alt">{stimulus.textAlternative}</p>;
      }
      return (
        <SceneContext
          stimulus={stimulus}
          media={media}
          resolveSrc={props.resolveSrc}
          onAssist={props.onAssist}
        />
      );
    }
    case "examples":
      return <ExamplesContext stimulus={stimulus} language={props.language} />;
  }
}

const contextLabelFor = (family: Family): string =>
  family === "story"
    ? "Story"
    : family === "conversation"
      ? "Dialogue"
      : family === "listening"
        ? "Audio"
        : "Context";

/* -------------------------------------------------------------------- shell */

/**
 * Returns a short hint string for the current practice step.
 * For cloze steps, returns the first letter of the first accepted answer.
 * For other exercise types, returns a generic prompt.
 */
export function showHint(activity: { kind: string; blanks?: Record<string, { answers: string[] }> } | null): string {
  if (!activity) return 'Try it';
  if (activity.kind === "inline-cloze" && activity.blanks) {
    const firstBlank = Object.values(activity.blanks)[0];
    if (firstBlank?.answers?.[0]) {
      return firstBlank.answers[0][0].toUpperCase();
    }
  }
  return 'Try it';
}

export function LessonPlayer(props: LessonPlayerProps) {
  const [identity, setIdentity] = useState({ pack: props.pack, environment: props.environment,
    lessonId: props.lessonId, generation: 0 });
  if (identity.pack !== props.pack || identity.environment !== props.environment || identity.lessonId !== props.lessonId) {
    setIdentity({ pack: props.pack, environment: props.environment, lessonId: props.lessonId,
      generation: identity.generation + 1 });
  }
  return <LessonPlayerSession key={identity.generation} {...props} />;
}

function LessonPlayerSession({
  pack,
  lessonId,
  environment,
  onExit,
}: LessonPlayerProps) {
  const [session, setSession] = useState<LessonSession | null>(null);
  const [draft, setDraft] = useState<Response | null>(null);
  const [assistanceUsed, setAssistanceUsed] = useState<Assistance[]>([]);
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const storeMissing = !environment.lessonPractice;
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const checkpointQueue = useRef<Promise<void>>(Promise.resolve());
  const [restartNotice, setRestartNotice] = useState<string | null>(null);
  const [resumedComplete, setResumedComplete] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [durability, setDurability] = useState<PracticeDurability>(() =>
    environment.practice.getDurability(),
  );

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const promptRef = useRef<HTMLHeadingElement | null>(null);
  const completeRef = useRef<HTMLHeadingElement | null>(null);
  const skipNextPromptFocus = useRef(true);

  const lesson = useMemo(
    () => pack.lessons.find((l) => l.id === lessonId) ?? null,
    [pack, lessonId],
  );
  const vocabularyByWord = useMemo(() => {
    const map = new Map<string, { word: string; meaning: string }>();
    for (const entry of pack.vocabulary) {
      map.set(entry.word.toLowerCase(), {
        word: entry.word,
        meaning: entry.meaning,
      });
    }
    return map;
  }, [pack]);
  const mediaById = useMemo(
    () => new Map(pack.media.map((asset) => [asset.id, asset])),
    [pack],
  );

  const complete = session !== null && (session.status === "complete" || resumedComplete);

  /* -------------------------------------------------------- mount / resume */

  useEffect(() => {
    let cancelled = false;
    const store = environment.lessonPractice;
    if (!store) return;
    (async () => {
      try {
        const [storedCheckpoint, events] = await Promise.all([
          store.readCheckpoint(pack.id, lessonId),
          store.readLessons(),
        ]);
        if (cancelled) return;
        let checkpoint = storedCheckpoint;
        if (!checkpoint) {
          const target = pack.lessons.find(l => l.id === lessonId);
          const quarantined = new Set(projectLessonEvidence(pack, events).quarantined);
          const completed = mergeLearningEvents(events).filter((e): e is StepCompletion =>
            "eventVersion" in e && e.type === "step-completed" && e.packId === pack.id &&
            e.lessonId === lessonId && e.lessonRevision === target?.revision && !quarantined.has(e.id));
          if (!target || !completed.length) { setSession(startLesson(pack, lessonId)); return; }
          const selectedBranches = Object.fromEntries(completed.filter(e => e.selectedBranchId)
            .map(e => [e.stepId, e.selectedBranchId!]));
          const trail = walkTrail(target, selectedBranches);
          const done = new Set(completed.map(e => e.stepId));
          const stepId = trail.find(id => !done.has(id)) ?? trail.at(-1)!;
          const assists = events.filter(isAttemptEvent).filter(e => e.packId === pack.id &&
            e.lessonId === lessonId && e.lessonRevision === target.revision && !quarantined.has(e.id))
            .flatMap(e => e.stepId === stepId ? e.assistance : e.assistance.filter(kind => kind === "translation" || kind === "transcript"));
          checkpoint = { packId: pack.id, lessonId, revision: target.revision, stepId,
            selectedBranches, assistance: [...new Set(assists)], draft: null, at: new Date().toISOString() };
        }
        const result = resumeSession(pack, checkpoint, events);
        if (cancelled) return;
        if (result.kind === "restart") {
          setRestartNotice(result.explanation);
          setSession(startLesson(pack, lessonId));
          return;
        }
        let resumed = result.session;
        if (resumed.completedStepIds.includes(resumed.activeStepId)) {
          // Completed but not advanced: rebuild the post-submit screen from
          // the step's last persisted attempt (feedback + chosen response).
          const last = lastAttemptFor(
            events,
            pack.id,
            lessonId,
            resumed.activeStepId,
            resumed.revision,
          );
          if (last) {
            resumed = {
              ...resumed,
              currentEvaluation: last.evaluation,
              draftResponse: last.response,
            };
          }
        }
        const target = pack.lessons.find((l) => l.id === lessonId);
        setSession(resumed);
        setDraft(resumed.draftResponse);
        if (target) {
          setResumedComplete(
            walkTrail(target, resumed.selectedBranches).every((stepId) =>
              resumed.completedStepIds.includes(stepId),
            ),
          );
        }
      } catch (error) {
        if (cancelled) return;
        setEngineError(
          `Your saved practice for this lesson could not be loaded. (${messageOf(error)})`,
        );
        // Do not overwrite a checkpoint we could not read. Exit and reopen to retry.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pack, lessonId, environment]);

  /* ---------------------------------------------------------- durability */

  useEffect(() => {
    return environment.practice.subscribeDurability(setDurability);
  }, [environment.practice]);

  /* -------------------------------------------------------------- focus */

  const activeLessonId = session?.lessonId;
  const activeStepId = session?.activeStepId;
  useEffect(() => {
    if (activeLessonId) titleRef.current?.focus();
  }, [activeLessonId]);

  useEffect(() => {
    if (!activeStepId || complete) return;
    if (skipNextPromptFocus.current) {
      skipNextPromptFocus.current = false;
      return;
    }
    promptRef.current?.focus();
  }, [activeStepId, complete]);

  useEffect(() => {
    if (complete) completeRef.current?.focus();
  }, [complete]);

  /* --------------------------------------------------------- persistence */

  const saveCheckpoint = useCallback(
    (state: LessonSession, draftValue: Response | null): Promise<void> => {
      const store = environment.lessonPractice;
      if (!store) return Promise.reject(new Error("Lesson storage is unavailable."));
      const checkpoint: LessonCheckpoint = {
        packId: pack.id, lessonId: state.lessonId, revision: state.revision,
        stepId: state.activeStepId, selectedBranches: state.selectedBranches,
        assistance: [...new Set([...state.accumulatedAssistance, ...assistanceUsed])],
        draft: draftValue, at: new Date().toISOString(),
      };
      // Serialize writes so an older draft cannot overwrite a newer checkpoint.
      const write = checkpointQueue.current.catch(() => {}).then(() => store.writeCheckpoint(checkpoint));
      checkpointQueue.current = write;
      return write;
    }, [environment, pack, assistanceUsed],
  );

  useEffect(() => {
    if (!session) return;
    let active = true;
    void saveCheckpoint(session, draft).then(() => {
      if (active) setCheckpointError(null);
    }).catch(() => {
      if (active) setCheckpointError("Your draft could not be saved. Try again before leaving.");
    });
    return () => { active = false; };
  }, [session, draft, saveCheckpoint]);

  /* ------------------------------------------------------------- actions */

  const recordAssist = useCallback((kind: Assistance) => {
    setAssistanceUsed((prev) =>
      prev.includes(kind) ? prev : [...prev, kind],
    );
  }, []);

  const commit = useCallback((state: LessonSession) => {
    setSession(state);
    setAssistanceUsed([]);
    setPending(null);
    setSaveError(false);
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!session || !lesson || pending || audioUnavailable) return;
    const store = environment.lessonPractice;
    if (!store) return;
    const step = lesson.steps.find((s) => s.id === session.activeStepId);
    if (!step) {
      setEngineError(`Unknown step ${session.activeStepId}`);
      return;
    }
    const supportOpen = session.activeSupportActivityId !== null;
    const assistance: Assistance[] = supportOpen ? [...new Set<Assistance>(["hint", ...assistanceUsed])] : assistanceUsed;
    const response: Response = supportOpen
      ? { kind: "continue" }
      : (draft ?? { kind: "continue" });

    let next: LessonSession;
    try {
      next = submitResponse(pack, session, response, assistance);
    } catch (error) {
      setEngineError(messageOf(error));
      return;
    }
    setEngineError(null);

    if (supportOpen) {
      // Support submissions are scaffolding only: no events, no completion;
      // the merged assistance taints the retry that follows.
      setSession(next);
      setAssistanceUsed([]);
      return;
    }

    const activity = pack.activities[step.activityId];
    if (!activity) {
      setEngineError(`Unknown activity ${step.activityId}`);
      return;
    }
    const now = new Date().toISOString();
    const attempt: ActivityAttempt = {
      eventVersion: 2,
      type: "attempt",
      id: crypto.randomUUID(),
      packId: pack.id,
      packVersion: pack.version,
      lessonId: session.lessonId,
      lessonRevision: session.revision,
      stepId: step.id,
      activityId: activity.id,
      activityRevision: activity.revision,
      ...("evidenceKey" in activity
        ? { evidenceKey: activity.evidenceKey }
        : {}),
      response,
      assistance: next.accumulatedAssistance,
      evaluation: next.currentEvaluation!,
      at: now,
    };
    const events: LearningEvent[] = [attempt];
    const freshCompletion =
      next.completedStepIds.includes(step.id) &&
      !session.completedStepIds.includes(step.id);
    if (freshCompletion) {
      const branches = step.branches ?? {};
      const completion: StepCompletion = {
        eventVersion: 2,
        type: "step-completed",
        id: crypto.randomUUID(),
        packId: pack.id,
        packVersion: pack.version,
        lessonId: session.lessonId,
        lessonRevision: session.revision,
        stepId: step.id,
        ...(branches[response.kind === "selection" ? response.ids[0] : ""] !==
          undefined
          ? { selectedBranchId: next.selectedBranches[step.id] }
          : {}),
        attemptId: attempt.id,
        at: now,
      };
      events.push(completion);
    }

    setPending({ events, commitSession: next });
    try {
      await store.writeLessons(events);
    } catch {
      // Keep the pending batch so Retry save re-sends the same ids.
      setSaveError(true);
      return;
    }
    // A read-only introduction has no feedback screen for a learner to act
    // on. Once its completion event is safely stored, take the same
    // "Continue" action straight to the first practice step.
    if (activity.kind === "information") {
      try {
        commit(advanceLesson(pack, next));
      } catch (error) {
        setEngineError(messageOf(error));
      }
      return;
    }
    commit(next);
  }, [
    session,
    lesson,
    pending,
    environment,
    pack,
    assistanceUsed,
    audioUnavailable,
    draft,
    commit,
  ]);

  const retrySave = useCallback(async (): Promise<void> => {
    const store = environment.lessonPractice;
    if (!store || !pending) return;
    try {
      await store.writeLessons(pending.events);
    } catch {
      return; // still failing; the alert and pending batch stay in place
    }
    commit(pending.commitSession);
  }, [environment, pending, commit]);

  const handleAdvance = useCallback((): void => {
    if (!session || pending) return;
    try {
      const next = advanceLesson(pack, session);
      setSession(next);
      setDraft(null);
      setAssistanceUsed([]);
    } catch (error) {
      setEngineError(messageOf(error));
    }
  }, [session, pending, pack]);

  const handleHelp = useCallback((): void => {
    if (!session || pending) return;
    try {
      setSession(openSupport(pack, session));
    } catch (error) {
      setEngineError(messageOf(error));
    }
  }, [session, pending, pack]);

  const handleBack = useCallback(async (): Promise<void> => {
    if (!session || pending) return;
    try {
      await saveCheckpoint(session, draft);
      onExit();
    } catch {
      setCheckpointError("Your draft could not be saved. Try again before leaving.");
    }
  }, [session, pending, saveCheckpoint, draft, onExit]);

  /* -------------------------------------------------------------- render */

  if (storeMissing) {
    return (
      <div className="lesson-player">
        <div role="alert" className="lp-error">
          Lesson practice storage is not available in this edition yet. Return
          to the course list.
        </div>
        <div className="lp-controls">
          <button type="button" className="lp-secondary" onClick={onExit}>
            <span aria-hidden="true">←</span> All lessons
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="lesson-player" aria-busy="true">
        {engineError ? (
          <div role="alert" className="lp-error">
            {engineError}
          </div>
        ) : (
          <p role="status">Loading your lesson…</p>
        )}
        <div className="lp-controls">
          <button type="button" className="lp-secondary" onClick={onExit}>
            <span aria-hidden="true">←</span> All lessons
          </button>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="lesson-player">
        <div role="alert" className="lp-error">
          That lesson does not exist in this course.
        </div>
        <div className="lp-controls">
          <button type="button" className="lp-secondary" onClick={onExit}>
            <span aria-hidden="true">←</span> All lessons
          </button>
        </div>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="lesson-player">
        <div className="lp-controls">
          <button
            type="button"
            className="lp-back"
            onClick={() => void handleBack()}
          >
            <span aria-hidden="true">←</span> All lessons
          </button>
        </div>
        {durability === "temporary" && (
          <p role="alert" className="lp-notice" data-tone="warn">
            Practice is saved temporarily on this device. It may not survive
            closing the browser.
          </p>
        )}
        <section className="lp-complete" aria-live="polite">
          <h2 className="lp-complete-title" tabIndex={-1} ref={completeRef}>
            Lesson complete
          </h2>
          <p className="lp-complete-body">
            Your practice for this lesson has been saved.
          </p>
          <div className="lp-controls">
            <button
              type="button"
              className="lp-secondary"
              onClick={() => void handleBack()}
            >
              Back to lessons
            </button>
          </div>
        </section>
      </div>
    );
  }

  const step =
    lesson.steps.find((s) => s.id === session.activeStepId) ?? null;
  if (!step) {
    return (
      <div className="lesson-player">
        <div role="alert" className="lp-error">
          This lesson step no longer exists.
        </div>
        <div className="lp-controls">
          <button type="button" className="lp-secondary" onClick={onExit}>
            <span aria-hidden="true">←</span> All lessons
          </button>
        </div>
      </div>
    );
  }

  const activity = pack.activities[step.activityId] ?? null;
  const supportActivity = session.activeSupportActivityId
    ? (pack.activities[session.activeSupportActivityId] ?? null)
    : null;
  if (!activity || (session.activeSupportActivityId && !supportActivity)) {
    return (
      <div className="lesson-player">
        <div role="alert" className="lp-error">
          This lesson activity no longer exists.
        </div>
        <div className="lp-controls">
          <button type="button" className="lp-secondary" onClick={onExit}>
            <span aria-hidden="true">←</span> All lessons
          </button>
        </div>
      </div>
    );
  }

  const supportOpen = session.activeSupportActivityId !== null;
  const stepCompleted = session.completedStepIds.includes(session.activeStepId);
  const branches = step.branches ?? {};
  const isTerminal = step.nextStepId === null && Object.keys(branches).length === 0;
  const promptTitle =
    activity.kind === "information" ? "Read" : activity.prompt;

  // The context stimulus belongs to the main step (not the support overlay),
  // falling back to the entry step's stimulus (e.g. a closing writing task
  // that reuses the lesson's opening passage).
  const entryActivity =
    pack.activities[
      lesson.steps.find((s) => s.id === lesson.entryStepId)?.activityId ?? ""
    ] ?? null;
  const contextStimulusId =
    activity.stimulusId ?? entryActivity?.stimulusId ?? null;
  const contextStimulus = contextStimulusId
    ? (pack.stimuli[contextStimulusId] ?? null)
    : null;

  const contextProps: ContextProps = {
    onAudioAvailabilityChange: setAudioUnavailable,
    language: pack.language,
    vocabularyByWord,
    mediaById,
    resolveSrc: (url: string) => environment.resolveMedia(url),
    onAssist: recordAssist,
  };
  const contextNode = contextStimulus ? (
    <Fragment key={contextStimulus.id}>
      {buildContext(contextStimulus, contextProps)}
    </Fragment>
  ) : null;

  const activityNode =
    supportOpen && supportActivity ? (
      <section aria-label="Support">
        <ActivityView
          activity={supportActivity}
          response={null}
          disabled={false}
          onChange={() => {}}
          onAssist={recordAssist}
          language={pack.language}
        />
      </section>
    ) : (
      <ActivityView
        key={activity.id}
        activity={activity}
        stimulus={contextStimulus ?? undefined}
        modelAudioUrl={activity.kind === "self-compare" && activity.modelAudioId && mediaById.has(activity.modelAudioId)
          ? environment.resolveMedia(mediaById.get(activity.modelAudioId)!.url) : undefined}
        language={pack.language}
        response={draft}
        disabled={pending !== null || stepCompleted}
        onChange={setDraft}
        onAssist={recordAssist}
      />
    );

  const contextLabel = contextLabelFor(lesson.family);
  const layoutChildren = {
    context: contextNode,
    activity: activityNode,
    contextLabel,
    objective: lesson.objective,
  };
  let layoutNode: ReactNode;
  switch (lesson.family) {
    case "story":
      layoutNode = <StoryLayout {...layoutChildren} />;
      break;
    case "conversation":
      layoutNode = <ConversationLayout {...layoutChildren} />;
      break;
    case "listening":
      layoutNode = <ListeningLayout {...layoutChildren} />;
      break;
    default:
      layoutNode = (
        <div className="lp-layout">
          <p className="lp-objective">{lesson.objective}</p>
          {contextNode !== null && (
            <details open className="lp-context">
              <summary>{contextLabel}</summary>
              {contextNode}
            </details>
          )}
          <div className="lp-activity">{activityNode}</div>
        </div>
      );
  }

  const evaluation = session.currentEvaluation;
  const feedbackNode =
    evaluation && evaluation.outcome !== "ungraded" ? (
      <div
        className="lp-feedback"
        data-outcome={evaluation.outcome}
        role="status"
      >
        <p className="lp-feedback-outcome">{outcomeWord(evaluation.outcome)}</p>
        {evaluation.feedback && (
          <p className="lp-feedback-body">{evaluation.feedback}</p>
        )}
        {(evaluation.outcome === "correct" ||
          evaluation.outcome === "self-assessed") && (
          <span className="lp-independence">
            {evaluation.independent
              ? "Saved — you answered this one from memory."
              : "Saved, but you used the answer on this step — we&rsquo;ll bring it back sooner."}
          </span>
        )}
      </div>
    ) : null;

  // A reveal taints the attempt the moment an evidence-bearing kind is used,
  // not only once it is saved — the same rule evaluateActivity applies, so the
  // learner hears it while they can still choose to answer from memory.
  const gradedActivity = session.activeSupportActivityId ? supportActivity : activity;
  const assistKinds =
    gradedActivity && "assistanceAffectsEvidence" in gradedActivity
      ? gradedActivity.assistanceAffectsEvidence
      : [];
  const assistanceTaints = [
    ...new Set([...session.accumulatedAssistance, ...assistanceUsed]),
  ].some((kind) => kind === "model" || assistKinds.includes(kind));
  const assistedNotice =
    !session.currentEvaluation && assistanceTaints ? (
      <p role="status" className="lp-assist-notice">
        You&rsquo;ve already seen the answer on this step, so it won&rsquo;t count as
        practice from memory. Answering the next one without help will.
      </p>
    ) : null;

  const trail = walkTrail(lesson, session.selectedBranches);
  const stepById = new Map(lesson.steps.map((s) => [s.id, s]));
  const requiredTrail = trail.filter(
    (stepId) => stepById.get(stepId)?.required === true,
  );
  const requiredDone = requiredTrail.filter((stepId) =>
    session.completedStepIds.includes(stepId),
  );

  const needsDraft =
    !supportOpen &&
    !stepCompleted &&
    activity.kind !== "information";
  const primaryDisabled = audioUnavailable || pending !== null || (needsDraft && !validResponse(draft));
  const primaryLabel = supportOpen
    ? "Continue"
    : stepCompleted
      ? isTerminal
        ? "Finish lesson"
        : "Next step"
      : activity.kind === "information"
        ? "Continue"
        : "Check";
  const onPrimary = supportOpen || !stepCompleted
    ? () => void handleSubmit()
    : handleAdvance;

  return (
    <div className="lesson-player">
      <header className="lp-header">
        <button
          type="button"
          className="lp-back"
          onClick={() => void handleBack()}
        >
          <span aria-hidden="true">←</span> All lessons
        </button>
        {requiredTrail.length > 0 && (
          <div className="lp-progress-track">
            <progress
              className="lp-progress"
              aria-label="Lesson progress"
              max={requiredTrail.length}
              value={requiredDone.length}
            />
            <span className="lp-count">
              {requiredDone.length} of {requiredTrail.length} steps completed
            </span>
          </div>
        )}
      </header>

      {durability === "temporary" && (
        <p role="alert" className="lp-notice" data-tone="warn">
          Practice is saved temporarily on this device. It may not survive
          closing the browser.
        </p>
      )}
      {restartNotice && (
        <p role="status" className="lp-notice" data-tone="info">
          {restartNotice}
        </p>
      )}
      {engineError && <div role="alert" className="lp-error">{engineError}</div>}
      {checkpointError && <div role="alert" className="lp-error">{checkpointError}</div>}
      {audioUnavailable && <div role="alert" className="lp-error">Audio could not play. Retry the audio before continuing.</div>}
      {pending && (
        <p role="status" className="lp-notice" data-tone="info">
          Saving your practice…
        </p>
      )}
      {saveError && (
        <div role="alert" className="lp-error">
          Your practice could not be saved.{" "}
          <button
            type="button"
            className="lp-secondary"
            onClick={() => void retrySave()}
          >
            Retry save
          </button>
        </div>
      )}

      <h2 className="lp-title" tabIndex={-1} ref={titleRef}>
        {lesson.title}
      </h2>
      <p className="lp-purpose">{step.purpose}</p>
      <h3 className="lp-prompt" tabIndex={-1} ref={promptRef}>
        {promptTitle}
      </h3>

      {layoutNode}
      {feedbackNode}
      {assistedNotice}

      <div className="lp-controls">
        {step.supportActivityId && !supportOpen && !stepCompleted && (
          <button
            type="button"
            className="lp-secondary lp-help"
            onClick={handleHelp}
          >
            Help
          </button>
        )}
        {!stepCompleted && activity.kind !== 'information' && (
          <button
            type="button"
            className="lp-secondary lp-hint"
            aria-describedby={hintVisible ? `hint-${step.id}` : undefined}
            onClick={() => setHintVisible(true)}
          >
            Hint
          </button>
        )}
        <button
          type="button"
          className="lp-primary"
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
      </div>
      {hintVisible && (
        <p id={`hint-${step.id}`} className="lp-hint-text" role="note">
          {showHint(activity)}
        </p>
      )}
    </div>
  );
}
