import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import content from "virtual:portable-content";

import catalog from "./catalog.json";
import { CourseWorkspace } from "./CourseWorkspace";
import { createPortableEnvironment } from "./portable-environment";
import { ListenView } from "@/components/listen/ListenView";
import { formatBytes } from "@/features/listen/catalog";

/**
 * The portable single file's shell.
 *
 * The file already carries every course pack, so Listen is reachable here too —
 * the pack comes from the embedded content, not a fetch, and the CSP allows
 * nothing else. Audio is a choice made at build time: with `--with-listen` the
 * tracks are embedded and play from blob URLs, without it the list still shows
 * what exists and each row says plainly that this file cannot play it. A player
 * that silently fails would be worse than saying so.
 */
async function start() {
  const environment = await createPortableEnvironment(content);
  const params = new URLSearchParams(location.search);
  const requested = params.get("language");
  const language = catalog.some((entry) => entry.slug === requested)
    ? requested!
    : "italian";
  const embedded = new Set(content.listen.map((entry) => entry.audioUrl));
  const courseTitle = catalog.find((entry) => entry.slug === language)?.title ?? language;

  function Shell() {
    const [view, setView] = useState<"course" | "listen">(
      params.get("view") === "listen" ? "listen" : "course",
    );
    const [title, setTitle] = useState(courseTitle);

    useEffect(() => {
      let active = true;
      environment
        .loadCourse?.(language)
        .then((pack) => {
          if (active && pack) setTitle(pack.title);
        })
        .catch(() => {
          // The course view reports its own failure; the title stays plain.
        });
      return () => {
        active = false;
      };
    }, []);

    return (
      <main id="main-content" className="study">
        <nav className="study-tabs" aria-label="Portable sections">
          <button
            type="button"
            aria-current={view === "course" ? "page" : undefined}
            onClick={() => setView("course")}
          >
            Course
          </button>
          <button
            type="button"
            aria-current={view === "listen" ? "page" : undefined}
            onClick={() => setView("listen")}
          >
            Listen
          </button>
        </nav>
        {view === "listen" ? (
          <ListenView
            courseSlug={language}
            courseTitle={title}
            readCourse={(slug) => environment.loadCourse!(slug)}
            resolveAudioSrc={(url) => environment.resolveMedia(url)}
            unavailableFor={(track) =>
              embedded.has(track.audioUrl)
                ? null
                : "Not in this file — it was built without the audio lessons."
            }
          >
            <p className="study-scope">
              {embedded.size > 0
                ? `This file carries ${formatBytes(
                    content.listen.reduce((total, entry) => total + entry.bytes, 0),
                  )} of audio lessons and plays with no connection.`
                : "This file was built without the audio lessons, so Listen shows what exists without playing it."}
            </p>
          </ListenView>
        ) : (
          <CourseWorkspace initialLanguage={language} environment={environment} />
        )}
      </main>
    );
  }

  createRoot(document.getElementById("study-root")!).render(<Shell />);
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
