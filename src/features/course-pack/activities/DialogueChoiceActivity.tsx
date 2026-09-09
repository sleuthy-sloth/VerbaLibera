"use client";
import type * as React from "react";
import type {
  DialogueChoiceActivity as DialogueChoiceSpec,
  Response,
} from "../lesson-runtime";

export function DialogueChoiceActivity({
  activity,
  response,
  disabled,
  onChange,
}: {
  activity: DialogueChoiceSpec;
  response: { kind: "selection"; ids: string[] } | null;
  disabled: boolean;
  onChange: (response: Response) => void;
}): React.JSX.Element {
  return (
    <fieldset className="lp-replies">
      <legend>Choose your reply</legend>
      {activity.options.map((option) => (
        <label key={option.id} className="lp-option">
          <input
            type="radio"
            name={activity.id}
            checked={response?.ids[0] === option.id}
            disabled={disabled}
            onChange={() => onChange({ kind: "selection", ids: [option.id] })}
          />
          <span>{option.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
