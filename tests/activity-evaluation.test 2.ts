import { describe, it, expect } from "vitest";
import { evaluateActivity } from "@/features/course-pack/activity-evaluation";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import type {
  ClozeActivity,
  MatchingActivity,
  OrderingActivity,
} from "@/features/course-pack/lesson-runtime";
import { makePilotPack } from "./fixtures/lesson-variety";

const pilot = () => normalizePack(makePilotPack());

describe("activity evaluation", () => {
  it("always treats model reveal as assistance even if a runtime policy omits it", () => {
    const pack = pilot();
    const activity = pack.activities["it-cafe-order-text"];
    if (activity.kind !== "text") throw new Error("Expected text fixture");
    expect(evaluateActivity({ ...activity, assistanceAffectsEvidence: [] },
      { kind: "text", text: "Un caffè, per favore." }, ["model"]).independent).toBe(false);
  });

  it("compares matching IDs without delimiter collisions", () => {
    const source = pilot().activities["it-cafe-order-text"];
    if (source.kind !== "text") throw new Error("Expected graded fixture");
    const activity: MatchingActivity = { ...source, kind: "matching",
      left: [{ id: "a|b", text: "first" }, { id: "a", text: "second" }],
      right: [{ id: "c", text: "first" }, { id: "b|c", text: "second" }],
      acceptedPairs: [{ leftId: "a|b", rightId: "c" }, { leftId: "a", rightId: "b|c" }],
    };
    expect(evaluateActivity(activity, { kind: "matching", pairs: activity.acceptedPairs }, []).outcome).toBe("correct");
  });

  it("does not credit a revealed answer independently", () => {
    const pack = pilot();
    const activity = pack.activities["it-cafe-order-text"];
    expect(
      evaluateActivity(
        activity,
        { kind: "text", text: "Un caffè, per favore." },
        ["model"],
      ),
    ).toMatchObject({ outcome: "correct", independent: false });
  });

  it("credits an unassisted correct answer independently", () => {
    const pack = pilot();
    expect(
      evaluateActivity(
        pack.activities["it-cafe-order-text"],
        { kind: "text", text: "Un caffè, per favore." },
        [],
      ),
    ).toMatchObject({ outcome: "correct", independent: true });
  });

  it("rejects wrong text with the answer engine explanation", () => {
    const pack = pilot();
    const evaluation = evaluateActivity(
      pack.activities["it-cafe-order-text"],
      { kind: "text", text: "Un tè." },
      [],
    );
    expect(evaluation.outcome).toBe("incorrect");
    expect(evaluation.independent).toBe(false);
    expect(evaluation.feedback.length).toBeGreaterThan(0);
  });

  it("requires exact selection sets and rejects duplicate IDs", () => {
    const pack = pilot();
    const activity = pack.activities["act-story-evidence"];
    expect(
      evaluateActivity(activity, { kind: "selection", ids: ["un-caffe"] }, []),
    ).toMatchObject({ outcome: "correct", independent: true });
    expect(
      evaluateActivity(activity, { kind: "selection", ids: ["un-te"] }, []),
    ).toMatchObject({ outcome: "incorrect" });
    expect(
      evaluateActivity(
        activity,
        { kind: "selection", ids: ["un-caffe", "un-caffe"] },
        [],
      ),
    ).toMatchObject({ outcome: "incorrect" });
  });

  it("places repeated word tokens by distinct ID", () => {
    const activity: OrderingActivity = {
      kind: "ordering",
      id: "dup-tokens",
      revision: 1,
      conceptIds: ["c-caffe-order"],
      vocabulary: [],
      skills: ["grammar"],
      prompt: "Order.",
      hints: [],
      feedback: "Good.",
      evidenceKey: "ev-dup",
      assistanceAffectsEvidence: ["model"],
      tokens: [
        { id: "w1", text: "il" },
        { id: "w2", text: "il" },
        { id: "w3", text: "cane" },
      ],
      acceptedOrders: [["w1", "w2", "w3"]],
    };
    expect(
      evaluateActivity(activity, { kind: "ordering", ids: ["w1", "w2", "w3"] }, []),
    ).toMatchObject({ outcome: "correct", independent: true });
    expect(
      evaluateActivity(activity, { kind: "ordering", ids: ["w1", "w1", "w3"] }, []),
    ).toMatchObject({ outcome: "incorrect" });
    expect(
      evaluateActivity(activity, { kind: "ordering", ids: ["w2", "w1", "w3"] }, []),
    ).toMatchObject({ outcome: "incorrect" });
  });

  it("grades matching by pair-set equality", () => {
    const pack = pilot();
    const activity = pack.activities["act-listen-distinguish"];
    const correct = [
      { leftId: "l-giorno", rightId: "r-greet" },
      { leftId: "l-grazie", rightId: "r-thanks" },
    ];
    expect(
      evaluateActivity(activity, { kind: "matching", pairs: correct }, []),
    ).toMatchObject({ outcome: "correct", independent: true });
    expect(
      evaluateActivity(
        activity,
        {
          kind: "matching",
          pairs: [
            { leftId: "l-giorno", rightId: "r-thanks" },
            { leftId: "l-grazie", rightId: "r-greet" },
          ],
        },
        [],
      ),
    ).toMatchObject({ outcome: "incorrect" });
  });

  it("assesses every named cloze blank", () => {
    const activity: ClozeActivity = {
      kind: "cloze",
      id: "cloze-one",
      revision: 1,
      conceptIds: ["c-caffe-order"],
      vocabulary: [],
      skills: ["writing"],
      prompt: "Fill.",
      hints: [],
      feedback: "Good.",
      evidenceKey: "ev-cloze",
      assistanceAffectsEvidence: ["model"],
      segments: [
        { kind: "text", text: "Un " },
        { kind: "blank", name: "drink", label: "drink" },
      ],
      blanks: {
        drink: { answers: ["caffè"], allowTypo: false, errors: [] },
      },
    };
    expect(
      evaluateActivity(activity, { kind: "cloze", values: { drink: "caffè" } }, []),
    ).toMatchObject({ outcome: "correct" });
    expect(
      evaluateActivity(activity, { kind: "cloze", values: { drink: "tè" } }, []),
    ).toMatchObject({ outcome: "incorrect" });
    expect(
      evaluateActivity(activity, { kind: "cloze", values: {} }, []),
    ).toMatchObject({ outcome: "incorrect" });
  });

  it("grades dialogue replies with authored per-reply feedback", () => {
    const pack = pilot();
    const activity = pack.activities["act-greet-choice"];
    expect(
      evaluateActivity(activity, { kind: "selection", ids: ["r-formal"] }, []),
    ).toMatchObject({
      outcome: "correct",
      independent: true,
      feedback: "Perfetto, formale.",
    });
    expect(
      evaluateActivity(activity, { kind: "selection", ids: ["r-casual"] }, []),
    ).toMatchObject({
      outcome: "incorrect",
      feedback: "Troppo informale per un barista sconosciuto.",
    });
  });

  it("treats self-comparison as self-assessed, never independent", () => {
    const pack = pilot();
    const activity = pack.activities["act-listen-self"];
    expect(
      evaluateActivity(activity, { kind: "self", rating: "comfortable" }, []),
    ).toMatchObject({ outcome: "self-assessed", independent: false });
    expect(
      evaluateActivity(activity, { kind: "text", text: "x" }, []),
    ).toMatchObject({ outcome: "incorrect" });
  });

  it("leaves information steps ungraded on continue", () => {
    const pack = pilot();
    expect(
      evaluateActivity(pack.activities["story-info"], { kind: "continue" }, []),
    ).toMatchObject({ outcome: "ungraded", independent: false });
  });

  it("rejects mismatched response kinds as incorrect", () => {
    const pack = pilot();
    expect(
      evaluateActivity(
        pack.activities["it-cafe-order-text"],
        { kind: "selection", ids: ["x"] },
        [],
      ),
    ).toMatchObject({ outcome: "incorrect", independent: false });
  });
});
