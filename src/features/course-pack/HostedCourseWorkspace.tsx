"use client";

import { useMemo } from "react";
import { AccountPractice, usePracticeAccount } from "./AccountPractice";
import { CourseWorkspace } from "./CourseWorkspace";
import { createHostedEnvironment } from "./hosted-environment";
import { synchronizePractice } from "./sync";

import type { WorkspaceView } from "./CourseWorkspace";

export function HostedCourseWorkspace({
  initialLanguage = "italian",
  startNextLesson = false,
  initialView,
}: {
  initialLanguage?: string;
  startNextLesson?: boolean;
  initialView?: WorkspaceView;
}) {
  const { scope, ready, select } = usePracticeAccount();
  const environment = useMemo(() => createHostedEnvironment(scope), [scope]);
  if (!ready) {
    return (
      <main id="main-content" className="study">
        <p>Opening your practice…</p>
      </main>
    );
  }
  return (
    <CourseWorkspace
      key={scope ?? "guest"}
      initialLanguage={initialLanguage}
      startNextLesson={startNextLesson}
      initialView={initialView}
      environment={environment}
      scope={scope}
      synchronize={synchronizePractice}
      renderAccountPractice={({ status, retry }) => (
        <AccountPractice
          scope={scope}
          select={select}
          status={status}
          retry={retry}
        />
      )}
    />
  );
}
