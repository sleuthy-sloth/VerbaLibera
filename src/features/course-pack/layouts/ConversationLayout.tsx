import type { ReactNode } from "react";

/**
 * Conversation family layout (Wave B, plan Task 6): the lesson objective is
 * framed as the conversation goal in a banner; the dialogue thread sits in
 * the context column and the reply activity on the right. Pure presentation.
 */
export type ConversationLayoutProps = {
  /** Rendered stimulus (dialogue thread and its assist controls). */
  context: ReactNode;
  /** Rendered activity input area. */
  activity: ReactNode;
  contextLabel: string;
  objective: string;
};

export function ConversationLayout({
  context,
  activity,
  contextLabel,
  objective,
}: ConversationLayoutProps) {
  return (
    <div className="lp-layout lp-conversation">
      <p className="lp-goal">{objective}</p>
      <details open className="lp-context">
        <summary>{contextLabel}</summary>
        {context}
      </details>
      <div className="lp-activity">{activity}</div>
    </div>
  );
}
