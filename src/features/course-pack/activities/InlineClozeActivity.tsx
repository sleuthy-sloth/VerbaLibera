"use client";
import type * as React from "react";
import type {
  ClozeActivity as ClozeSpec,
  Response,
} from "../lesson-runtime";

export function InlineClozeActivity({
  activity,
  response,
  disabled,
  onChange,
}: {
  activity: ClozeSpec;
  response: { kind: "cloze"; values: Record<string, string> } | null;
  disabled: boolean;
  onChange: (response: Response) => void;
}): React.JSX.Element {
  const values = response?.values ?? {};
  return (
    <p className="lp-cloze">
      {activity.segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={`text-${index}`}>{segment.text}</span>
        ) : (
          <input
            key={segment.name}
            className="lp-blank"
            type="text"
            aria-label={segment.label}
            value={values[segment.name] ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                kind: "cloze",
                values: { ...values, [segment.name]: event.target.value },
              })
            }
          />
        ),
      )}
    </p>
  );
}
