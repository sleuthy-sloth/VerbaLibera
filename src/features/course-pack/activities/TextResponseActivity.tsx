"use client";
import { useState } from "react";
import type * as React from "react";
import type {
  Assistance,
  Response,
  TextActivity as TextSpec,
} from "../lesson-runtime";

export function TextResponseActivity({
  activity,
  response,
  disabled,
  onChange,
  onAssist,
}: {
  activity: TextSpec;
  response: { kind: "text"; text: string } | null;
  disabled: boolean;
  onChange: (response: Response) => void;
  onAssist: (kind: Assistance) => void;
}): React.JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const inputId = `${activity.id}-answer`;
  const model = activity.answer.answers.join(" / ");
  return (
    <div className="lp-text-response">
      <label htmlFor={inputId}>Your answer</label>
      <textarea
        id={inputId}
        className="lp-textarea"
        rows={4}
        value={response?.text ?? ""}
        disabled={disabled}
        onChange={(event) => onChange({ kind: "text", text: event.target.value })}
      />
      <div className="lp-assist">
        {revealed ? (
          <p className="lp-model">{model}</p>
        ) : (
          <button
            type="button"
            className="lp-model-reveal"
            onClick={() => {
              setRevealed(true);
              onAssist("model");
            }}
          >
            Reveal a model answer
          </button>
        )}
      </div>
    </div>
  );
}
