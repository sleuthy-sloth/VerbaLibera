import { createRoot } from "react-dom/client";
import content from "virtual:portable-content";

import catalog from "./catalog.json";
import { CourseWorkspace } from "./CourseWorkspace";
import { createPortableEnvironment } from "./portable-environment";

async function start() {
  const environment = await createPortableEnvironment(content);
  const requested = new URLSearchParams(location.search).get("language");
  const language = catalog.some((entry) => entry.slug === requested)
    ? requested!
    : "italian";
  createRoot(document.getElementById("study-root")!).render(
    <CourseWorkspace initialLanguage={language} environment={environment} />,
  );
}

void start().catch((error: unknown) => {
  const root = document.getElementById("study-root");
  if (root) {
    root.textContent =
      error instanceof Error
        ? `VerbaLibera could not open: ${error.message}`
        : "VerbaLibera could not open.";
  }
});
