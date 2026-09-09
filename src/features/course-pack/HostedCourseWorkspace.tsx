"use client";

import { useMemo } from "react";
import { AccountPractice, usePracticeAccount } from "./AccountPractice";
import { CourseWorkspace } from "./CourseWorkspace";
import { createHostedEnvironment } from "./hosted-environment";
import { synchronizePractice } from "./sync";

export function HostedCourseWorkspace({
  initialLanguage = "italian",
  startNextLesson = false,
}: {
  initialLanguage?: string;
  startNextLesson?: boolean;
}) {
  const { scope, ready, select } = usePracticeAccount();
  const environment = useMemo(() => createHostedEnvironment(scope), [scope]);
  if (!ready) {
    return (
      <main id="main-content" className="study">
        <p>Opening device practice…</p>
      </main>
    );
  }
  return (
    <CourseWorkspace
      key={scope ?? "guest"}
      initialLanguage={initialLanguage}
      startNextLesson={startNextLesson}
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
