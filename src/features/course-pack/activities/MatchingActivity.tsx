"use client";
import { useState } from "react";
import type * as React from "react";
import type {
  MatchingActivity as MatchingSpec,
  Response,
} from "../lesson-runtime";

export function MatchingActivity({
  activity,
  response,
  disabled,
  onChange,
}: {
  activity: MatchingSpec;
  response: {
    kind: "matching";
    pairs: Array<{ leftId: string; rightId: string }>;
  } | null;
  disabled: boolean;
  onChange: (response: Response) => void;
}): React.JSX.Element {
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const pairs = response?.pairs ?? [];
  const pairedLeft = new Set(pairs.map((pair) => pair.leftId));
  const pairedRight = new Set(pairs.map((pair) => pair.rightId));
  const leftById = new Map(activity.left.map((item) => [item.id, item.text]));
  const rightById = new Map(activity.right.map((item) => [item.id, item.text]));

  const pair = (leftId: string, rightId: string) => {
    onChange({
      kind: "matching",
      pairs: [...pairs, { leftId, rightId }],
    });
    setSelectedLeftId(null);
  };
  const unpair = (leftId: string, rightId: string) => {
    onChange({
      kind: "matching",
      pairs: pairs.filter(
        (existing) =>
          existing.leftId !== leftId || existing.rightId !== rightId,
      ),
    });
  };

  return (
    <div className="lp-matching">
      <div className="lp-match-columns">
        <ul className="lp-match-left">
          {activity.left.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="lp-match-item"
                aria-pressed={selectedLeftId === item.id}
                disabled={disabled || pairedLeft.has(item.id)}
                onClick={() => setSelectedLeftId(item.id)}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
        <ul className="lp-match-right">
          {activity.right.map((item) => {
            const selectedLeft =
              selectedLeftId === null
                ? null
                : activity.left.find((left) => left.id === selectedLeftId) ??
                  null;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="lp-match-item lp-match-right-item"
                  aria-label={
                    selectedLeft
                      ? `Pair ${item.text} with ${selectedLeft.text}`
                      : undefined
                  }
                  disabled={
                    disabled ||
                    pairedRight.has(item.id) ||
                    selectedLeftId === null
                  }
                  onClick={() => {
                    if (selectedLeftId !== null) pair(selectedLeftId, item.id);
                  }}
                >
                  {item.text}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="lp-pairs">
        {pairs.map((entry) => (
          <li key={`${entry.leftId}|${entry.rightId}`}>
            {leftById.get(entry.leftId) ?? entry.leftId} —{" "}
            {rightById.get(entry.rightId) ?? entry.rightId}
            <button
              type="button"
              className="lp-unpair"
              aria-label={`Unpair ${leftById.get(entry.leftId) ?? entry.leftId}`}
              disabled={disabled}
              onClick={() => unpair(entry.leftId, entry.rightId)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
