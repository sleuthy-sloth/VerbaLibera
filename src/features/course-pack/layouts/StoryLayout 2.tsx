import type { ReactNode } from "react";

/**
 * Story family layout (Wave B, plan Task 6): story text on the left, the
 * activity on the right, objective across the top. Pure presentation — no
 * grading, persistence, or engine knowledge.
 */
export type StoryLayoutProps = {
  /** Rendered stimulus (story passage and its assist controls). */
  context: ReactNode;
  /** Rendered activity input area (prompt and controls live in the shell). */
  activity: ReactNode;
  contextLabel: string;
  objective: string;
};

export function StoryLayout({
  context,
  activity,
  contextLabel,
  objective,
}: StoryLayoutProps) {
  return (
    <div className="lp-layout lp-story">
      <p className="lp-objective">{objective}</p>
      <details open className="lp-context">
        <summary>{contextLabel}</summary>
        {context}
      </details>
      <div className="lp-activity">{activity}</div>
    </div>
  );
}
