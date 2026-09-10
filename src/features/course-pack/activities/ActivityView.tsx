"use client";
import { useState } from "react";
import type * as React from "react";
import type {
  Activity,
  Assistance,
  Response,
  Stimulus,
} from "../lesson-runtime";
import { SelfCompareActivity } from "./SelfCompareActivity";
import { SceneSelectionActivity } from "./SceneSelectionActivity";
import { DialogueChoiceActivity } from "./DialogueChoiceActivity";
import { InformationActivity } from "./InformationActivity";
import { InlineClozeActivity } from "./InlineClozeActivity";
import { MatchingActivity } from "./MatchingActivity";
import { OrderingActivity } from "./OrderingActivity";
import { SelectionActivity } from "./SelectionActivity";
import { TextResponseActivity } from "./TextResponseActivity";

/**
 * Graded kinds that render the hint area (excludes information, self-compare,
 * and the not-yet-supported legacy/scene-selection kinds).
 */
function isHintable(
  activity: Activity,
): activity is Extract<Activity, { hints: string[] }> {
  return (
    activity.kind !== "information" &&
    activity.kind !== "self-compare" &&
    activity.kind !== "legacy" &&
    activity.kind !== "scene-selection" &&
    activity.hints.length > 0
  );
}

export function ActivityView({
  activity,
  response,
  disabled,
  onChange,
  onAssist,
  stimulus,
  modelAudioUrl,
  language,
}: {
  activity: Activity;
  stimulus?: Stimulus;
  modelAudioUrl?: string;
  /**
   * BCP-47 code of the target language. Marked on the strings the content model
   * guarantees are target-language, so a screen reader does not read «Je
   * voudrais» with English phonemes. Choice options and matching columns mix
   * target text with English glosses and stay unmarked rather than guessed at.
   */
  language?: string;
  response: Response | null;
  disabled: boolean;
  onChange: (response: Response) => void;
  onAssist: (kind: Assistance) => void;
}): React.JSX.Element {
  const [hintRevealed, setHintRevealed] = useState(false);

  let controls: React.JSX.Element;
  switch (activity.kind) {
    case "information":
      controls = <InformationActivity activity={activity} />;
      break;
    case "selection":
      controls = (
        <SelectionActivity
          activity={activity}
          response={response?.kind === "selection" ? response : null}
          disabled={disabled}
          onChange={onChange}
        />
      );
      break;
    case "ordering":
      controls = (
        <OrderingActivity
          activity={activity}
          response={response?.kind === "ordering" ? response : null}
          disabled={disabled}
          onChange={onChange}
        />
      );
      break;
    case "matching":
      controls = (
        <MatchingActivity
          activity={activity}
          response={response?.kind === "matching" ? response : null}
          disabled={disabled}
          onChange={onChange}
        />
      );
      break;
    case "cloze":
      controls = (
        <InlineClozeActivity
          activity={activity}
          response={response?.kind === "cloze" ? response : null}
          disabled={disabled}
          onChange={onChange}
        />
      );
      break;
    case "dialogue-choice":
      controls = (
        <DialogueChoiceActivity
          activity={activity}
          response={response?.kind === "selection" ? response : null}
          disabled={disabled}
          onChange={onChange}
        />
      );
      break;
    case "text":
      controls = (
        <TextResponseActivity
          activity={activity}
          response={response?.kind === "text" ? response : null}
          disabled={disabled}
          onChange={onChange}
          onAssist={onAssist}
        />
      );
      break;
    case "self-compare":
      controls = <SelfCompareActivity activity={activity} disabled={disabled} onChange={onChange} onAssist={onAssist} modelAudioUrl={modelAudioUrl} language={language} />;
      break;
    case "scene-selection":
      controls = stimulus?.kind === "scene"
        ? <SceneSelectionActivity stimulus={stimulus} response={response} disabled={disabled} onChange={onChange} />
        : <p role="alert">The scene for this activity is unavailable.</p>;
      break;
    case "legacy":
      controls = (
        <p className="lp-unsupported">
          This player does not yet support {activity.kind} activities.
        </p>
      );
      break;
    default: {
      // Exhaustiveness guard: a new activity kind must fail compilation here.
      const exhaustive: never = activity;
      return exhaustive;
    }
  }

  return (
    <div className="lp-controls">
      {isHintable(activity) &&
        (hintRevealed ? (
          <p className="lp-hint-reveal">{activity.hints[0]}</p>
        ) : (
          <button
            type="button"
            className="lp-hint"
            onClick={() => {
              setHintRevealed(true);
              onAssist("hint");
            }}
          >
            Hint
          </button>
        ))}
      {controls}
    </div>
  );
}
