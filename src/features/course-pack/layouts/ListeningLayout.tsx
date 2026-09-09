import type { ReactNode } from "react";

/**
 * Listening family layout (Wave B, plan Task 6): audio player on the left,
 * activity on the right, objective across the top. Pure presentation — no
 * autoplay; playback is always user-initiated.
 */
export type ListeningLayoutProps = {
  /** Rendered stimulus (audio element and its assist controls). */
  context: ReactNode;
  /** Rendered activity input area. */
  activity: ReactNode;
  contextLabel: string;
  objective: string;
};

export function ListeningLayout({
  context,
  activity,
  contextLabel,
  objective,
}: ListeningLayoutProps) {
  return (
    <div className="lp-layout lp-listening">
      <p className="lp-objective">{objective}</p>
      <details open className="lp-context">
        <summary>{contextLabel}</summary>
        {context}
      </details>
      <div className="lp-activity">{activity}</div>
    </div>
  );
}
