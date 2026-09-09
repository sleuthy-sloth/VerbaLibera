import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type * as React from "react";
import { ActivityView } from "@/features/course-pack/activities/ActivityView";
import { DialogueChoiceActivity } from "@/features/course-pack/activities/DialogueChoiceActivity";
import { InformationActivity } from "@/features/course-pack/activities/InformationActivity";
import { InlineClozeActivity } from "@/features/course-pack/activities/InlineClozeActivity";
import { MatchingActivity } from "@/features/course-pack/activities/MatchingActivity";
import { OrderingActivity } from "@/features/course-pack/activities/OrderingActivity";
import { SelectionActivity } from "@/features/course-pack/activities/SelectionActivity";
import { TextResponseActivity } from "@/features/course-pack/activities/TextResponseActivity";
import type {
  ClozeActivity as ClozeSpec,
  DialogueChoiceActivity as DialogueChoiceSpec,
  InformationActivity as InformationSpec,
  MatchingActivity as MatchingSpec,
  OrderingActivity as OrderingSpec,
  SelectionActivity as SelectionSpec,
  SelfCompareActivity as SelfCompareSpec,
  TextActivity as TextSpec,
} from "@/features/course-pack/lesson-runtime";
import type { Response } from "@/features/course-pack/lesson-runtime";

/**
 * Controlled harness: applies onChange through real state so user interactions
 * accumulate exactly as they would in the lesson player.
 */
function Stateful({
  onChange,
  children,
}: {
  onChange: (response: Response) => void;
  children: (
    response: Response | null,
    setResponse: (response: Response) => void,
  ) => React.JSX.Element;
}) {
  const [response, setResponse] = useState<Response | null>(null);
  return children(response, (next) => {
    onChange(next);
    setResponse(next);
  });
}

const selectionSpec: SelectionSpec = {
  kind: "selection",
  id: "sel-1",
  revision: 1,
  conceptIds: [],
  vocabulary: [],
  skills: ["vocabulary"],
  prompt: "Choose one answer.",
  hints: [],
  feedback: "Correct!",
  evidenceKey: "sel-1",
  assistanceAffectsEvidence: ["hint"],
  options: [
    { id: "opt-a", text: "Bonjour" },
    { id: "opt-b", text: "Au revoir" },
  ],
  acceptedIds: ["opt-a"],
  multiple: false,
};

const multiSpec: SelectionSpec = {
  ...selectionSpec,
  id: "sel-2",
  options: [
    { id: "opt-a", text: "Bonjour" },
    { id: "opt-b", text: "Au revoir" },
  ],
  acceptedIds: ["opt-a", "opt-b"],
  multiple: true,
};

const orderSpec: OrderingSpec = {
  kind: "ordering",
  id: "ord-1",
  revision: 1,
  conceptIds: [],
  vocabulary: [],
  skills: ["grammar"],
  prompt: "Put the words in order.",
  hints: [],
  feedback: "Correct!",
  evidenceKey: "ord-1",
  assistanceAffectsEvidence: ["hint"],
  tokens: [
    { id: "t1", text: "per" },
    { id: "t2", text: "per" },
    { id: "t3", text: "Vorrei" },
  ],
  acceptedOrders: [["t1", "t2", "t3"]],
};

const matchingSpec: MatchingSpec = {
  kind: "matching",
  id: "mat-1",
  revision: 1,
  conceptIds: [],
  vocabulary: [],
  skills: ["vocabulary"],
  prompt: "Match the pairs.",
  hints: [],
  feedback: "Correct!",
  evidenceKey: "mat-1",
  assistanceAffectsEvidence: ["hint"],
  left: [
    { id: "l-giorno", text: "buongiorno" },
    { id: "l-grazie", text: "grazie" },
  ],
  right: [
    { id: "r-greet", text: "greeting" },
    { id: "r-thanks", text: "thank you" },
  ],
  acceptedPairs: [
    { leftId: "l-giorno", rightId: "r-greet" },
    { leftId: "l-grazie", rightId: "r-thanks" },
  ],
};

const clozeSpec: ClozeSpec = {
  kind: "cloze",
  id: "clz-1",
  revision: 1,
  conceptIds: [],
  vocabulary: [],
  skills: ["reading"],
  prompt: "Fill the blanks.",
  hints: [],
  feedback: "Correct!",
  evidenceKey: "clz-1",
  assistanceAffectsEvidence: ["hint"],
  segments: [
    { kind: "text", text: "Ciao " },
    { kind: "blank", name: "b1", label: "First blank" },
    { kind: "text", text: " e " },
    { kind: "blank", name: "b2", label: "Second blank" },
  ],
  blanks: {
    b1: { answers: ["mondo"], allowTypo: false, errors: [] },
    b2: { answers: ["amico"], allowTypo: false, errors: [] },
  },
};

const dialogueSpec: DialogueChoiceSpec = {
  kind: "dialogue-choice",
  id: "dlg-1",
  revision: 1,
  conceptIds: [],
  vocabulary: [],
  skills: ["speaking"],
  prompt: "Choose your reply.",
  hints: [],
  feedback: "Correct!",
  evidenceKey: "dlg-1",
  assistanceAffectsEvidence: ["hint"],
  options: [
    { id: "r-formal", text: "Bonjour, madame.", feedback: "Polite." },
    { id: "r-casual", text: "Salut !", feedback: "Casual." },
  ],
  acceptedIds: ["r-formal"],
};

const textSpec: TextSpec = {
  kind: "text",
  id: "txt-1",
  revision: 1,
  conceptIds: [],
  vocabulary: [],
  skills: ["writing"],
  prompt: "Write your answer.",
  hints: [],
  feedback: "Correct!",
  evidenceKey: "txt-1",
  assistanceAffectsEvidence: ["hint", "model"],
  answer: { answers: ["Un caffè, per favore."], allowTypo: false, errors: [] },
};

const infoSpec: InformationSpec = {
  kind: "information",
  id: "inf-1",
  revision: 1,
  body: "Bonjour means hello.",
};

const selfCompareSpec: SelfCompareSpec = {
  kind: "self-compare",
  id: "sc-1",
  revision: 1,
  conceptIds: [],
  vocabulary: [],
  skills: ["speaking"],
  prompt: "Say hello.",
  modelText: "Bonjour !",
};

const hintedSpec: SelectionSpec = {
  ...selectionSpec,
  id: "sel-hint",
  hints: ["Look for the greeting."],
};

describe("LessonActivities", () => {
  it("selection single: radios switch the chosen option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Stateful onChange={onChange}>
        {(response, setResponse) => (
          <SelectionActivity
            activity={selectionSpec}
            response={response?.kind === "selection" ? response : null}
            disabled={false}
            onChange={setResponse}
          />
        )}
      </Stateful>,
    );
    expect(screen.getByText("Choose one answer")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    await user.click(screen.getByRole("radio", { name: "Bonjour" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "selection", ids: ["opt-a"] });
    await user.click(screen.getByRole("radio", { name: "Au revoir" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "selection",
      ids: ["opt-b"],
    });
  });

  it("selection single: disabled radio does not call onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectionActivity
        activity={selectionSpec}
        response={null}
        disabled={true}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("radio", { name: "Bonjour" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("selection multiple: checkboxes append in click order and uncheck filters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Stateful onChange={onChange}>
        {(response, setResponse) => (
          <SelectionActivity
            activity={multiSpec}
            response={response?.kind === "selection" ? response : null}
            disabled={false}
            onChange={setResponse}
          />
        )}
      </Stateful>,
    );
    expect(screen.getByText("Choose all that apply")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    await user.click(screen.getByRole("checkbox", { name: "Bonjour" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "selection", ids: ["opt-a"] });
    await user.click(screen.getByRole("checkbox", { name: "Au revoir" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "selection",
      ids: ["opt-a", "opt-b"],
    });
    await user.click(screen.getByRole("checkbox", { name: "Bonjour" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "selection",
      ids: ["opt-b"],
    });
  });

  it("ordering: duplicate tokens get stable positional labels and reorder/remove", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Stateful onChange={onChange}>
        {(response, setResponse) => (
          <OrderingActivity
            activity={orderSpec}
            response={response?.kind === "ordering" ? response : null}
            disabled={false}
            onChange={setResponse}
          />
        )}
      </Stateful>,
    );
    expect(screen.getByRole("button", { name: "Add per (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add per (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Vorrei" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add per (1)" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "ordering", ids: ["t1"] });
    await user.click(screen.getByRole("button", { name: "Add per (2)" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "ordering",
      ids: ["t1", "t2"],
    });
    // both "per" tokens are placed; the bank only keeps "Vorrei"
    expect(screen.getByRole("button", { name: "Remove per (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove per (2)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add per (2)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Vorrei" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove per (2)" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "ordering", ids: ["t1"] });
    // the removed token returns to the bank with the same stable label
    expect(screen.getByRole("button", { name: "Add per (2)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add per (2)" }));
    // ids back to ["t1", "t2"]; boundary buttons are disabled
    expect(screen.getByRole("button", { name: "Move per up (1)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move per down (2)" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move per up (2)" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "ordering", ids: ["t2", "t1"] });
    await user.click(screen.getByRole("button", { name: "Move per up (1)" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "ordering", ids: ["t1", "t2"] });
    await user.click(screen.getByRole("button", { name: "Move per down (1)" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "ordering", ids: ["t2", "t1"] });
  });

  it("ordering: full sequence emits ids that match the placed visual order", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <Stateful onChange={onChange}>
        {(response, setResponse) => (
          <OrderingActivity
            activity={orderSpec}
            response={response?.kind === "ordering" ? response : null}
            disabled={false}
            onChange={setResponse}
          />
        )}
      </Stateful>,
    );
    await user.click(screen.getByRole("button", { name: "Add Vorrei" }));
    await user.click(screen.getByRole("button", { name: "Add per (1)" }));
    await user.click(screen.getByRole("button", { name: "Add per (2)" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "ordering",
      ids: ["t3", "t1", "t2"],
    });
    await user.click(screen.getByRole("button", { name: "Move per up (1)" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "ordering",
      ids: ["t1", "t3", "t2"],
    });
    const placedTexts = container.querySelectorAll(".lp-placed .lp-token-text");
    expect(Array.from(placedTexts).map((el) => el.textContent)).toEqual([
      "per",
      "Vorrei",
      "per",
    ]);
  });

  it("matching: select, pair, unpair, and full pairing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Stateful onChange={onChange}>
        {(response, setResponse) => (
          <MatchingActivity
            activity={matchingSpec}
            response={response?.kind === "matching" ? response : null}
            disabled={false}
            onChange={setResponse}
          />
        )}
      </Stateful>,
    );
    // with no left item selected, right buttons are disabled
    expect(screen.getByRole("button", { name: "greeting" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "thank you" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "buongiorno" }));
    expect(screen.getByRole("button", { name: "buongiorno" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Pair greeting with buongiorno" }));
    expect(onChange).toHaveBeenCalledWith({
      kind: "matching",
      pairs: [{ leftId: "l-giorno", rightId: "r-greet" }],
    });
    expect(screen.getByRole("button", { name: "buongiorno" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Unpair buongiorno" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "matching", pairs: [] });
    expect(screen.getByRole("button", { name: "buongiorno" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "buongiorno" }));
    await user.click(screen.getByRole("button", { name: "Pair greeting with buongiorno" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "matching",
      pairs: [{ leftId: "l-giorno", rightId: "r-greet" }],
    });
    await user.click(screen.getByRole("button", { name: "grazie" }));
    await user.click(screen.getByRole("button", { name: "Pair thank you with grazie" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "matching",
      pairs: [
        { leftId: "l-giorno", rightId: "r-greet" },
        { leftId: "l-grazie", rightId: "r-thanks" },
      ],
    });
    // complete set stays rendered; paired items are disabled
    expect(screen.getByRole("button", { name: "buongiorno" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "grazie" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "greeting" })).toBeDisabled();
  });

  it("cloze: typing into blanks accumulates values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Stateful onChange={onChange}>
        {(response, setResponse) => (
          <InlineClozeActivity
            activity={clozeSpec}
            response={response?.kind === "cloze" ? response : null}
            disabled={false}
            onChange={setResponse}
          />
        )}
      </Stateful>,
    );
    await user.type(screen.getByLabelText("First blank"), "x");
    expect(onChange).toHaveBeenLastCalledWith({ kind: "cloze", values: { b1: "x" } });
    await user.type(screen.getByLabelText("Second blank"), "y");
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "cloze",
      values: { b1: "x", b2: "y" },
    });
  });

  it("dialogue-choice: legend and radio emit a selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DialogueChoiceActivity
        activity={dialogueSpec}
        response={null}
        disabled={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Choose your reply")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Bonjour, madame." }));
    expect(onChange).toHaveBeenCalledWith({
      kind: "selection",
      ids: ["r-formal"],
    });
  });

  it("text response: typing emits the full text on the last change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Stateful onChange={onChange}>
        {(response, setResponse) => (
          <TextResponseActivity
            activity={textSpec}
            response={response?.kind === "text" ? response : null}
            disabled={false}
            onChange={setResponse}
            onAssist={vi.fn()}
          />
        )}
      </Stateful>,
    );
    const textarea = screen.getByLabelText("Your answer");
    await user.type(textarea, "Un caffè");
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "text",
      text: "Un caffè",
    });
  });

  it("text response: disabled textarea rejects typing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TextResponseActivity
        activity={textSpec}
        response={null}
        disabled={true}
        onChange={onChange}
        onAssist={vi.fn()}
      />,
    );
    const textarea = screen.getByLabelText("Your answer");
    expect(textarea).toBeDisabled();
    await user.type(textarea, "x");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("text response: model answer is absent until revealed and onAssist fires once", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAssist = vi.fn();
    render(
      <TextResponseActivity
        activity={textSpec}
        response={null}
        disabled={false}
        onChange={onChange}
        onAssist={onAssist}
      />,
    );
    // the model text must not exist anywhere in the DOM before the click
    expect(screen.queryByText("Un caffè, per favore.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reveal a model answer" }));
    expect(screen.getByText("Un caffè, per favore.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reveal a model answer" })).not.toBeInTheDocument();
    expect(onAssist).toHaveBeenCalledTimes(1);
    expect(onAssist).toHaveBeenCalledWith("model");
  });

  it("information: renders the body only", () => {
    render(<InformationActivity activity={infoSpec} />);
    expect(screen.getByText("Bonjour means hello.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("ActivityView: routes selection to radios and self-compare to its model reveal", () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <ActivityView
        activity={selectionSpec}
        response={null}
        disabled={false}
        onChange={onChange}
        onAssist={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: "Bonjour" })).toBeInTheDocument();
    unmount();
    render(
      <ActivityView
        activity={selfCompareSpec}
        response={null}
        disabled={false}
        onChange={onChange}
        onAssist={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", {name: "Reveal comparison model"}),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hint" })).not.toBeInTheDocument();
  });

  it("ActivityView: hint button reveals the hint and records assistance once", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAssist = vi.fn();
    render(
      <ActivityView
        activity={hintedSpec}
        response={null}
        disabled={false}
        onChange={onChange}
        onAssist={onAssist}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByText("Look for the greeting.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hint" })).not.toBeInTheDocument();
    expect(onAssist).toHaveBeenCalledTimes(1);
    expect(onAssist).toHaveBeenCalledWith("hint");
  });

  it("ordering: Add token is reachable by keyboard Tab and Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <OrderingActivity
        activity={orderSpec}
        response={null}
        disabled={false}
        onChange={onChange}
      />,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Add per (1)" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith({ kind: "ordering", ids: ["t1"] });
  });
});
