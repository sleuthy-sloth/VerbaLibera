"use client";
import { useEffect, useRef, useState } from "react";
import { GlossedText } from "./GlossedText";
import type { CoursePack, Exercise } from "./schema";
import { evaluateAnswer, type Evaluation } from "./answer";
import { feedbackFor } from "./feedback";
import { ThinkGate } from "./ThinkGate";

type InputProps = {
  exercise: Exercise;
  value: string;
  onChange: (s: string) => void;
  disabled: boolean;
  onHint: () => void;
  pack: CoursePack;
  resolveMedia: (url: string) => string;
};
function TextInput({ value, onChange, disabled }: InputProps) {
  return (
    <label>
      Your answer
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        autoComplete="off"
        autoCapitalize="sentences"
        spellCheck={false}
      />
    </label>
  );
}
function ChoiceInput(props: InputProps) {
  if (props.exercise.kind !== "choice") return null;
  return (
    <fieldset>
      <legend>Choose an answer</legend>
      {props.exercise.options.map((option) => (
        <label className="study-choice" key={option}>
          <input
            type="radio"
            name="answer"
            checked={props.value === option}
            onChange={() => props.onChange(option)}
            disabled={props.disabled}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
function OrderInput(props: InputProps) {
  const [used, setUsed] = useState<number[]>([]);
  if (props.exercise.kind !== "order") return null;
  const tokens = props.exercise.tokens;
  return (
    <div>
      <div className="sentence-workbench" aria-label="Your sentence">
        {used.length ? used.map((tokenIndex, position) => (
          <button type="button" key={tokenIndex} disabled={props.disabled} aria-label={`Remove ${tokens[tokenIndex]}`} onClick={() => {
            const next = used.filter((_, i) => i !== position);
            setUsed(next);
            props.onChange(next.map(j => tokens[j]).join(" "));
          }}>{tokens[tokenIndex]} <span aria-hidden="true">×</span></button>
        )) : <p>Tap words below to build your sentence.</p>}
      </div>
      <p className="study-scope" aria-live="polite">{props.value ? `${used.length} words placed. Tap a placed word to change it.` : "Your sentence is empty."}</p>
      <div className="word-bank">
        {tokens.map((token, i) => (
          <button
            type="button"
            key={i}
            disabled={props.disabled || used.includes(i)}
            onClick={() => {
              const next = [...used, i];
              setUsed(next);
              props.onChange(next.map((j) => tokens[j]).join(" "));
            }}
          >
            {token}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => {
          setUsed([]);
          props.onChange("");
        }}
      >
        Reset words
      </button>
    </div>
  );
}
function ClozeInput(props: InputProps) {
  // Authored cloze contracts require a blank. Preserve the surrounding sentence
  // while grading only the missing text, as before.
  const blank = props.exercise.prompt.indexOf("___");
  const before = props.exercise.prompt.slice(0, blank).replace(/^Complete:\s*/i, "");
  const after = props.exercise.prompt.slice(blank + 3);
  return <div className="study-cloze">
    <p className="study-scope">Complete the thought with the missing word.</p>
    <div className="study-cloze-sentence">
      <span>{before}</span>
      <input aria-label="Missing word" value={props.value} onChange={e => props.onChange(e.target.value)} disabled={props.disabled} autoComplete="off" spellCheck={false} />
      <span>{after}</span>
    </div>
  </div>;
}

function ListeningInput(props: InputProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [slow, setSlow] = useState(false);
  if (props.exercise.kind !== "dictation") return null;
  const media = props.pack.media.find(
    (m) =>
      m.id ===
      (props.exercise as Extract<Exercise, { kind: "dictation" }>).audioId,
  );
  return (
    <>
      <audio
        ref={ref}
        controls
        preload="metadata"
        src={media ? props.resolveMedia(media.url) : undefined}
        onError={() => setUnavailable(true)}
        aria-label="Dictation audio"
      />
      <button
        type="button"
        onClick={() => {
          const next = !slow;
          setSlow(next);
          if (ref.current) ref.current.playbackRate = next ? 0.75 : 1;
        }}
      >
        {slow ? "Use normal speed (1×)" : "Use slow replay (0.75×)"}
      </button>
      {unavailable ? (
        <p>
          Audio could not play. Reveal the model to study this item; it will
          remain due.
        </p>
      ) : null}
      <TextInput {...props} />
    </>
  );
}
function ReadingInput(props: InputProps) {
  if (props.exercise.kind !== "reading") return null;
  return (
    <>
      <GlossedText
        text={props.exercise.passage}
        pack={props.pack}
        onLookup={props.onHint}
      />
      <details>
        <summary onClick={props.onHint}>Sentence translation</summary>
        <p>{props.exercise.translation}</p>
      </details>
      <TextInput {...props} />
    </>
  );
}
function ThinkInput(props: InputProps) {
  const [ready, setReady] = useState(false);
  if (props.exercise.kind !== "think") return null;
  if (!ready) {
    return (
      <ThinkGate className="study-think-gate" onClear={() => setReady(true)} />
    );
  }
  return <TextInput {...props} />;
}
const renderers: Record<Exercise["kind"], React.ComponentType<InputProps>> = {
  translate: TextInput,
  think: ThinkInput,
  choice: ChoiceInput,
  order: OrderInput,
  cloze: ClozeInput,
  transform: TextInput,
  dictation: ListeningInput,
  reading: ReadingInput,
};
const activityNames: Record<Exercise["kind"], string> = {
  choice: "Spot the meaning", order: "Build a sentence", cloze: "Find the missing word",
  reading: "Read a small story", dictation: "Tune your ear", think: "Say it before you write it",
  translate: "Make the connection", transform: "Change the pattern",
};

export function ExerciseView({
  exercise,
  pack,
  onSave,
  resolveMedia = (url) => url,
}: {
  exercise: Exercise;
  pack: CoursePack;
  onSave: (result: Evaluation, revealed: boolean) => Promise<void>;
  resolveMedia?: (url: string) => string;
}) {
  const [value, setValue] = useState(""),
    [result, setResult] = useState<Evaluation | null>(null),
    [revealed, setRevealed] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const Input = renderers[exercise.kind];
  // Learner-facing wording lives in one module so the grader's taxonomy can
  // never reach the screen (see feedback.ts).
  const feedback = result ? feedbackFor(result, exercise) : null;
  return (
    <section className={`practice-panel activity-${exercise.kind}`} aria-labelledby="practice-title">
      <p className="study-eyebrow">
        {activityNames[exercise.kind]}
      </p>
      <h2 id="practice-title" ref={heading} tabIndex={-1}>
        {exercise.prompt}
      </h2>
      <Input
        exercise={exercise}
        pack={pack}
        value={value}
        onChange={setValue}
        disabled={!!result}
        onHint={() => setRevealed(true)}
        resolveMedia={resolveMedia}
      />
      <div className="study-actions">
        {!result ? (
          <button
            className="study-primary"
            disabled={!value.trim()}
            onClick={() => setResult(evaluateAnswer(value, exercise))}
          >
            Check answer
          </button>
        ) : null}
        {!revealed ? (
          <button
            onClick={() => {
              setRevealed(true);
              if (!result)
                setResult({
                  accepted: false,
                  // Revealing is not an answer: it earns no credit either way.
                  credit: "none",
                  category: "model revealed",
                  explanation: "Here is the model answer. Compare it with yours before moving on.",
                  model: exercise.answers[0],
                });
            }}
          >
            Reveal model
          </button>
        ) : null}
      </div>
      {result && feedback ? (
        <div
          role="status"
          className="study-feedback"
          data-outcome={
            result.category === "model revealed"
              ? "neutral"
              : result.accepted
                ? "correct"
                : "attention"
          }
        >
          <strong>{feedback.headline}</strong>
          {feedback.detail ? <p>{feedback.detail}</p> : null}
          {revealed && result.accepted ? (
            <p>It comes back sooner because you looked. That is the point of it.</p>
          ) : null}
          {feedback.showModel ? (
            <p lang={pack.language}>{result.model}</p>
          ) : null}
          <details open={!result.accepted || revealed}>
            <summary>Why this works</summary>
            <p>{exercise.explanation}</p>
          </details>
          <button
            className="study-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                await onSave(result, revealed);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not save. Try again.",
                );
                setSaving(false);
              }
            }}
          >
            Continue
          </button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
