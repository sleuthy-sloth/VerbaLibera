"use client";
import type * as React from "react";
import type { InformationActivity as InformationSpec } from "../lesson-runtime";

export function InformationActivity({
  activity,
}: {
  activity: InformationSpec;
}): React.JSX.Element {
  return <div className="lp-info-body">{activity.body}</div>;
}
