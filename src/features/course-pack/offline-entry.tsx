import catalog from "./catalog.json";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { HostedCourseWorkspace } from "./HostedCourseWorkspace";
import { normalizePack } from "./normalize-pack";
import { ListenView } from "@/components/listen/ListenView";
import { formatBytes, listenBytesFor } from "@/features/listen/catalog";

const requested = new URLSearchParams(location.search).get("language");
const language = catalog.some((entry) => entry.slug === requested)
  ? requested!
  : "italian";

/**
 * The downloaded edition's shell.
 *
 * It used to render the course and nothing else, which meant a learner who
 * installed a language for offline use lost the audio-lesson path entirely —
 * Listen existed only inside the hosted app. Listen is now a first-class view
 * here, served from the same download the learner already has: the pack comes
 * from the service-worker cache, and the long track was cached with it (see
 * `installPack`), so both work with the network off.
 *
 * Listen is deliberately independent of course progress: it is a separate way
 * into the language, and a lesson being locked must not lock its audio.
 */
function OfflineShell() {
  // `?view=listen` makes the audio path addressable, the same way the portable
  // file does it — a home-screen shortcut can open Listen directly.
  const [view, setView] = useState<"course" | "listen">(
    new URLSearchParams(location.search).get("view") === "listen" ? "listen" : "course",
  );
  const [courseTitle, setCourseTitle] = useState(language);

  useEffect(() => {
    let active = true;
    // The pack is already cached by the download; this is a cache read, not a
    // network call, and it is where the lesson titles come from.
    fetch(`/packs/${language}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((raw) => {
        if (!active || !raw) return;
        setCourseTitle((normalizePack(raw) as { title?: string }).title ?? language);
      })
      .catch(() => {
        // The course view reports its own failure; the title just stays plain.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main id="main-content" className="study">
      <nav className="study-tabs" aria-label="Offline sections">
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
          courseTitle={courseTitle}
          readCourse={(slug) =>
            fetch(`/packs/${slug}.json`)
              .then((response) => {
                if (!response.ok) throw new Error("Course pack is not downloaded yet.");
                return response.json();
              })
              .then((raw) => normalizePack(raw))
          }
        >
          <p className="study-scope">
            Saved on this device: {formatBytes(listenBytesFor(language))} of audio lessons. Play
            them with no connection.
          </p>
        </ListenView>
      ) : (
        <HostedCourseWorkspace initialLanguage={language} />
      )}
    </main>
  );
}

createRoot(document.getElementById("study-root")!).render(<OfflineShell />);
