"use client";
import type * as React from "react";
import type {
  OrderingActivity as OrderingSpec,
  Response,
} from "../lesson-runtime";

export function OrderingActivity({
  activity,
  response,
  disabled,
  onChange,
}: {
  activity: OrderingSpec;
  response: { kind: "ordering"; ids: string[] } | null;
  disabled: boolean;
  onChange: (response: Response) => void;
}): React.JSX.Element {
  const placedIds = response?.ids ?? [];
  const placedTokens = placedIds
    .map((id) => activity.tokens.find((token) => token.id === id))
    .filter(
      (token): token is { id: string; text: string } => token !== undefined,
    );
  const placedIdSet = new Set(placedIds);
  const bankTokens = activity.tokens.filter(
    (token) => !placedIdSet.has(token.id),
  );

  // Stable 1-based position among tokens that share the same visible text,
  // derived from activity.tokens order regardless of placement.
  const counts = new Map<string, number>();
  for (const token of activity.tokens) {
    counts.set(token.text, (counts.get(token.text) ?? 0) + 1);
  }
  const indexByText = new Map<string, number>();
  const duplicatePosition = new Map<string, number>();
  for (const token of activity.tokens) {
    const n = (indexByText.get(token.text) ?? 0) + 1;
    indexByText.set(token.text, n);
    if ((counts.get(token.text) ?? 0) > 1) {
      duplicatePosition.set(token.id, n);
    }
  }
  const suffix = (token: { id: string; text: string }) => {
    const n = duplicatePosition.get(token.id);
    return n === undefined ? "" : ` (${n})`;
  };

  const add = (id: string) => {
    onChange({ kind: "ordering", ids: [...placedIds, id] });
  };
  const move = (index: number, delta: -1 | 1) => {
    const next = [...placedIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ kind: "ordering", ids: next });
  };
  const remove = (index: number) => {
    onChange({
      kind: "ordering",
      ids: placedIds.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="lp-ordering">
      <ol className="lp-placed">
        {placedTokens.map((token, index) => (
          <li key={token.id}>
            <span className="lp-token-text">{token.text}</span>
            <span className="lp-token-actions">
              <button
                type="button"
                aria-label={`Move ${token.text} up${suffix(token)}`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                Move up
              </button>
              <button
                type="button"
                aria-label={`Move ${token.text} down${suffix(token)}`}
                disabled={disabled || index === placedTokens.length - 1}
                onClick={() => move(index, 1)}
              >
                Move down
              </button>
              <button
                type="button"
                aria-label={`Remove ${token.text}${suffix(token)}`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ol>
      <ul className="lp-bank">
        {bankTokens.map((token) => (
          <li key={token.id}>
            <button
              type="button"
              className="lp-token lp-add"
              aria-label={`Add ${token.text}${suffix(token)}`}
              disabled={disabled}
              onClick={() => add(token.id)}
            >
              {token.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
