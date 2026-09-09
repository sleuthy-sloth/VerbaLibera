"use client";
import type * as React from "react";
import type {
  Response,
  SelectionActivity as SelectionSpec,
} from "../lesson-runtime";

export function SelectionActivity({
  activity,
  response,
  disabled,
  onChange,
}: {
  activity: SelectionSpec;
  response: { kind: "selection"; ids: string[] } | null;
  disabled: boolean;
  onChange: (response: Response) => void;
}): React.JSX.Element {
  return (
    <fieldset className="lp-options">
      <legend>
        {activity.multiple ? "Choose all that apply" : "Choose one answer"}
      </legend>
      {activity.options.map((option) => (
        <label key={option.id} className="lp-option">
          {activity.multiple ? (
            <input
              type="checkbox"
              checked={response?.ids.includes(option.id) ?? false}
              disabled={disabled}
              onChange={(event) => {
                const current = response?.ids ?? [];
                const ids = event.target.checked
                  ? [...current, option.id]
                  : current.filter((id) => id !== option.id);
                onChange({ kind: "selection", ids });
              }}
            />
          ) : (
            <input
              type="radio"
              name={activity.id}
              checked={response?.ids[0] === option.id}
              disabled={disabled}
              onChange={() => onChange({ kind: "selection", ids: [option.id] })}
            />
          )}
          <span>{option.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
