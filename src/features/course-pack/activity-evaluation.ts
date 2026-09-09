import { evaluateAnswer } from "./answer";
import type {
  Activity,
  Assistance,
  Evaluation,
  Response,
} from "./lesson-runtime";

/**
 * Deterministic typed evaluation (plan Task 3). Pure function: no storage,
 * clocks, or randomness. `evaluateAnswer` stays the text engine underneath
 * text, cloze-blank, and legacy activities.
 */

const sameSet = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, i) => value === sortedB[i]);
};

const samePairs = (
  a: Array<{ leftId: string; rightId: string }>,
  b: Array<{ leftId: string; rightId: string }>,
): boolean => {
  if (a.length !== b.length) return false;
  const key = (p: { leftId: string; rightId: string }) =>
    JSON.stringify([p.leftId, p.rightId]);
  return sameSet(a.map(key), b.map(key));
};

const mismatch = (activityId: string): Evaluation => ({
  outcome: "incorrect",
  independent: false,
  feedback: `Response does not fit activity ${activityId}. Try again.`,
});

export function evaluateActivity(
  activity: Activity,
  response: Response,
  assistance: Assistance[],
): Evaluation {
  const tainted =
    assistance.includes("model") ||
    "assistanceAffectsEvidence" in activity &&
    assistance.some((kind) =>
      activity.assistanceAffectsEvidence.includes(kind),
    );
  const independent = !tainted;
  const retry = (feedback: string): Evaluation => ({
    outcome: "incorrect",
    independent: false,
    feedback,
  });

  switch (activity.kind) {
    case "information":
      return response.kind === "continue"
        ? { outcome: "ungraded", independent: false, feedback: "" }
        : mismatch(activity.id);

    case "self-compare":
      return response.kind === "self"
        ? {
            outcome: "self-assessed",
            independent: false,
            feedback: activity.modelText,
          }
        : mismatch(activity.id);

    case "text": {
      if (response.kind !== "text") return mismatch(activity.id);
      const result = evaluateAnswer(response.text, activity.answer);
      return result.accepted
        ? {
            outcome: "correct",
            independent,
            feedback: activity.feedback,
          }
        : retry(result.explanation);
    }

    case "legacy": {
      if (response.kind !== "text") return mismatch(activity.id);
      const result = evaluateAnswer(response.text, activity.exercise);
      return result.accepted
        ? { outcome: "correct", independent, feedback: activity.feedback }
        : retry(result.explanation);
    }

    case "selection": {
      if (response.kind !== "selection") return mismatch(activity.id);
      const options = new Set(activity.options.map((o) => o.id));
      if (
        response.ids.some((id) => !options.has(id)) ||
        new Set(response.ids).size !== response.ids.length ||
        (!activity.multiple && response.ids.length !== 1)
      )
        return retry(
          activity.hints[0] ?? "That selection is not valid. Try again.",
        );
      return sameSet(response.ids, activity.acceptedIds)
        ? { outcome: "correct", independent, feedback: activity.feedback }
        : retry(activity.hints[0] ?? "Not quite — try again.");
    }

    case "dialogue-choice": {
      if (response.kind !== "selection") return mismatch(activity.id);
      const options = new Map(activity.options.map((o) => [o.id, o]));
      if (response.ids.length !== 1 || !options.has(response.ids[0]))
        return retry("Choose one of the authored replies.");
      const chosen = options.get(response.ids[0])!;
      return activity.acceptedIds.includes(chosen.id)
        ? { outcome: "correct", independent, feedback: chosen.feedback }
        : { outcome: "incorrect", independent: false, feedback: chosen.feedback };
    }

    case "scene-selection": {
      if (response.kind !== "selection") return mismatch(activity.id);
      if (new Set(response.ids).size !== response.ids.length)
        return retry("Each region counts once. Try again.");
      return sameSet(response.ids, activity.acceptedRegionIds)
        ? { outcome: "correct", independent, feedback: activity.feedback }
        : retry(activity.hints[0] ?? "Not quite — try again.");
    }

    case "ordering": {
      if (response.kind !== "ordering") return mismatch(activity.id);
      const tokens = activity.tokens.map((t) => t.id);
      if (!sameSet(response.ids, tokens)) return retry("Place every token exactly once.");
      return activity.acceptedOrders.some((order) =>
        order.every((id, i) => response.ids[i] === id),
      )
        ? { outcome: "correct", independent, feedback: activity.feedback }
        : retry(activity.hints[0] ?? "The order is not right yet. Try again.");
    }

    case "matching": {
      if (response.kind !== "matching") return mismatch(activity.id);
      const left = new Set(activity.left.map((o) => o.id));
      const right = new Set(activity.right.map((o) => o.id));
      if (
        response.pairs.some((p) => !left.has(p.leftId) || !right.has(p.rightId)) ||
        new Set(response.pairs.map((p) => JSON.stringify([p.leftId, p.rightId]))).size !==
          response.pairs.length
      )
        return retry("Each pairing must use listed items exactly once.");
      return samePairs(response.pairs, activity.acceptedPairs)
        ? { outcome: "correct", independent, feedback: activity.feedback }
        : retry(activity.hints[0] ?? "Some pairs are off. Try again.");
    }

    case "cloze": {
      if (response.kind !== "cloze") return mismatch(activity.id);
      for (const [name, spec] of Object.entries(activity.blanks)) {
        const result = evaluateAnswer(response.values[name] ?? "", spec);
        if (!result.accepted) return retry(result.explanation);
      }
      return { outcome: "correct", independent, feedback: activity.feedback };
    }
  }
}
