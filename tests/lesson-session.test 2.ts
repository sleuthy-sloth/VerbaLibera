import { describe, it, expect } from "vitest";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import {
  advanceLesson,
  openSupport,
  startLesson,
  submitResponse,
} from "@/features/course-pack/lesson-session";
import type { Response } from "@/features/course-pack/lesson-runtime";
import { makePilotPack } from "./fixtures/lesson-variety";

const pilot = () => normalizePack(makePilotPack());

describe("lesson session", () => {
  it("does not advance using stale success after a wrong retry", () => {
    const pack = pilot();
    let state = advanceLesson(pack, submitResponse(pack, startLesson(pack, "it-cafe-story"), { kind: "continue" }, []));
    state = submitResponse(pack, state, { kind: "selection", ids: ["un-caffe"] }, []);
    state = submitResponse(pack, state, { kind: "selection", ids: ["un-te"] }, []);
    expect(() => advanceLesson(pack, state)).toThrow(/not complete/i);
  });

  it("support cannot supply the main step evaluation", () => {
    const pack = pilot();
    let state = advanceLesson(pack, submitResponse(pack, startLesson(pack, "it-cafe-conversation"), { kind: "continue" }, []));
    state = openSupport(pack, state);
    state = submitResponse(pack, state, { kind: "continue" }, []);
    expect(state.currentEvaluation).toBeNull();
    expect(state.accumulatedAssistance).toContain("hint");
    expect(() => advanceLesson(pack, state)).toThrow();
  });

  it("starts at the authored entry step", () => {
    const pack = pilot();
    const state = startLesson(pack, "it-cafe-story");
    expect(state).toMatchObject({
      lessonId: "it-cafe-story",
      revision: 1,
      activeStepId: "st-s1",
      status: "active",
    });
    expect(state.visitedStepIds).toEqual(["st-s1"]);
  });

  it("refuses to advance before evaluation", () => {
    const pack = pilot();
    const state = startLesson(pack, "it-cafe-story");
    expect(() => advanceLesson(pack, state)).toThrow(/evaluation/i);
  });

  it("holds an incorrect step for retry without synthesizing evidence", () => {
    const pack = pilot();
    let state = startLesson(pack, "it-cafe-story");
    state = submitResponse(pack, state, { kind: "continue" }, []);
    state = advanceLesson(pack, state);
    state = submitResponse(
      pack,
      state,
      { kind: "selection", ids: ["un-te"] },
      [],
    );
    expect(state.currentEvaluation?.outcome).toBe("incorrect");
    expect(state.completedStepIds).not.toContain("st-s2");
    expect(() => advanceLesson(pack, state)).toThrow(/not complete/i);
    state = submitResponse(
      pack,
      state,
      { kind: "selection", ids: ["un-caffe"] },
      [],
    );
    expect(state.completedStepIds).toContain("st-s2");
    state = advanceLesson(pack, state);
    expect(state.activeStepId).toBe("st-s3");
  });

  it("follows the selected dialogue branch after feedback", () => {
    const pack = pilot();
    let state = startLesson(pack, "it-cafe-conversation");
    state = submitResponse(pack, state, { kind: "continue" }, []);
    state = advanceLesson(pack, state);
    state = submitResponse(
      pack,
      state,
      { kind: "selection", ids: ["r-casual"] },
      [],
    );
    expect(state.currentEvaluation?.outcome).toBe("incorrect");
    expect(state.selectedBranches).not.toHaveProperty("cv-s2");
    state = submitResponse(
      pack,
      state,
      { kind: "selection", ids: ["r-formal"] },
      [],
    );
    expect(state.selectedBranches["cv-s2"]).toBe("r-formal");
    state = advanceLesson(pack, state);
    expect(state.activeStepId).toBe("cv-s3");
    expect(state.visitedStepIds).toEqual(["cv-s1", "cv-s2", "cv-s3"]);
  });

  it("returns from support to the current step carrying assistance", () => {
    const pack = pilot();
    let state = startLesson(pack, "it-cafe-conversation");
    state = submitResponse(pack, state, { kind: "continue" }, []);
    state = advanceLesson(pack, state);
    state = openSupport(pack, state);
    state = submitResponse(pack, state, { kind: "continue" }, ["hint"]);
    expect(state.activeSupportActivityId).toBeNull();
    expect(state.accumulatedAssistance).toContain("hint");
    expect(state.completedStepIds).not.toContain("cv-s2");
    // The carried hint taints the retry: a correct reply is not independent.
    state = submitResponse(
      pack,
      state,
      { kind: "selection", ids: ["r-formal"] },
      [],
    );
    expect(state.currentEvaluation).toMatchObject({
      outcome: "correct",
      independent: false,
    });
  });

  it("completes a lesson at its terminal step", () => {
    const pack = pilot();
    let state = startLesson(pack, "it-cafe-story");
    const answers: Response[] = [
      { kind: "continue" },
      { kind: "selection", ids: ["un-caffe"] },
      { kind: "ordering", ids: ["t-saluta", "t-ordina", "t-ringrazia"] },
      { kind: "text", text: "Un caffè, per favore." },
    ];
    for (const response of answers) {
      state = submitResponse(pack, state, response, []);
      state = advanceLesson(pack, state);
    }
    expect(state.status).toBe("complete");
    expect(() =>
      submitResponse(pack, state, { kind: "continue" }, []),
    ).toThrow(/complete/i);
  });

  it("restarts instead of applying a changed revision", () => {
    const pack = pilot();
    const state = startLesson(pack, "it-cafe-story");
    const changed = normalizePack({
      ...makePilotPack(),
      lessons: (makePilotPack().lessons as unknown[]).map((l) =>
        (l as Record<string, unknown>).id === "it-cafe-story"
          ? { ...(l as Record<string, unknown>), revision: 2 }
          : l,
      ),
    });
    expect(() =>
      submitResponse(changed, state, { kind: "continue" }, []),
    ).toThrow(/changed/i);
  });

  it("rejects unknown lessons at start", () => {
    const pack = pilot();
    expect(() => startLesson(pack, "nope")).toThrow(/unknown lesson/i);
  });
});

it('keeps shared reference assistance but clears a previous activity model on advance', () => {
  const pack = normalizePack(makePilotPack());
  let state = startLesson(pack, 'it-cafe-story');
  state = submitResponse(pack, state, {kind:'continue'}, ['translation']);
  state = advanceLesson(pack, state);
  state = submitResponse(pack, state, {kind:'selection',ids:['un-caffe']}, ['model']);
  state = advanceLesson(pack, state);
  expect(state.accumulatedAssistance).toEqual(['translation']);
});
