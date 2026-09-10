import type { Metadata } from "next";
import { notFound } from "next/navigation";
import catalog from "@/features/course-pack/catalog.json";
import { HostedCourseWorkspace } from "@/features/course-pack/HostedCourseWorkspace";
import type { WorkspaceView } from "@/features/course-pack/CourseWorkspace";
import "@/features/course-pack/study.css";

/**
 * Addressable workspace views: /courses/french/vocabulary, /courses/french/grammar,
 * /courses/french/review, /courses/french/dialogues.
 *
 * These used to be buttons with `aria-current="page"` and a `useState` inside the
 * workspace, so the selected view could not be linked, shared, reloaded into, or
 * reached with the browser Back button.
 */
const VIEW_BY_SEGMENT: Record<string, WorkspaceView> = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  review: "Review",
  dialogues: "Dialogues",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string; view: string }>;
}): Promise<Metadata> {
  const { language, view } = await params;
  const entry = catalog.find((course) => course.slug === language);
  const label = view.charAt(0).toUpperCase() + view.slice(1);
  return {
    title: entry ? `${label} — ${entry.title.replace(/ foundations$/, "")}` : label,
  };
}

export function generateStaticParams() {
  return catalog.flatMap((entry) =>
    Object.keys(VIEW_BY_SEGMENT).map((view) => ({ language: entry.slug, view })),
  );
}

/**
 * Only the authored combinations exist. Without this, an unknown language or
 * view segment renders the not-found UI *after* the shell has streamed and
 * reports 200 — a soft 404 that looks broken but claims success.
 */
export const dynamicParams = false;

export default async function CourseViewPage({
  params,
}: {
  params: Promise<{ language: string; view: string }>;
}) {
  const { language, view } = await params;
  if (!catalog.some((entry) => entry.slug === language)) notFound();
  const resolved = VIEW_BY_SEGMENT[view];
  if (!resolved) notFound();
  return (
    <HostedCourseWorkspace
      key={`${language}:${view}`}
      initialLanguage={language}
      initialView={resolved}
    />
  );
}
