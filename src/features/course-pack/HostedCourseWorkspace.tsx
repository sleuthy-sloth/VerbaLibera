"use client";

import { AccountPractice, usePracticeAccount } from "./AccountPractice";
import { CourseWorkspace } from "./CourseWorkspace";
import { createHostedEnvironment } from "./hosted-environment";
import { synchronizePractice } from "./sync";

const HOSTED_ENVIRONMENT = createHostedEnvironment();

export function HostedCourseWorkspace({
  initialLanguage = "italian",
}: {
  initialLanguage?: string;
}) {
  const { scope, ready, select } = usePracticeAccount();
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
      environment={HOSTED_ENVIRONMENT}
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
