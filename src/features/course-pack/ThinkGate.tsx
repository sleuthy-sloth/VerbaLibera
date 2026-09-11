"use client";

import { useState } from "react";

/**
 * The think-first gate.
 *
 * A `think` exercise (v1) and a `predict` step (v2) both mean the same thing in
 * the Thinking Method: say it in your head before you see anything to copy. The
 * gate is shared by both players so the promise the copy makes cannot drift
 * between them — the v1→v2 adapter maps `think` to a `predict` step precisely so
 * a migrated pack keeps this pause instead of silently becoming a fill-in-the-blank.
 *
 * Clearing the gate is a commitment, not assistance: it must never taint the
 * attempt (`onAssist` is deliberately not called), or a predicted answer would
 * stop earning full credit the moment the learner asked for the input.
 */
export function ThinkGate({
  className,
  onClear,
}: {
  className: string;
  onClear: () => void;
}) {
  return (
    <div className={className}>
      <p>
        <strong>Think first — don&apos;t write yet.</strong> Say it in your head,
        out loud, or to whoever is nearby. There is nothing to memorize; build it
        from what this lesson already gave you.
      </p>
      <button type="button" onClick={onClear}>
        I&apos;ve thought about it — let me answer
      </button>
    </div>
  );
}

/** Gate state for one step at a time, shared by both players' render paths. */
export function useThinkGate() {
  const [cleared, setCleared] = useState<string[]>([]);
  return {
    isCleared: (stepId: string) => cleared.includes(stepId),
    clear: (stepId: string) =>
      setCleared((current) =>
        current.includes(stepId) ? current : [...current, stepId],
      ),
  };
}
