import catalog from "./catalog.json";
import { createRoot } from "react-dom/client";
import { HostedCourseWorkspace } from "./HostedCourseWorkspace";
const language = new URLSearchParams(location.search).get("language");
createRoot(document.getElementById("study-root")!).render(
  <HostedCourseWorkspace
    initialLanguage={
      catalog.some((entry) => entry.slug === language) ? language! : "italian"
    }
  />,
);
