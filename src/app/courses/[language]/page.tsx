import type { Metadata } from "next";
import catalog from "@/features/course-pack/catalog.json";
import { notFound } from "next/navigation";
import { HostedCourseWorkspace } from "@/features/course-pack/HostedCourseWorkspace";
import "@/features/course-pack/study.css";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>;
}): Promise<Metadata> {
  const { language } = await params;
  const entry = catalog.find((course) => course.slug === language);
  return {
    title: entry ? entry.title : "Course",
    description: entry
      ? `Work through ${entry.title.replace(/ foundations$/, "")} one pattern at a time, with model audio and offline study.`
      : undefined,
  };
}

export function generateStaticParams() {
  return catalog.map((entry) => ({ language: entry.slug }));
}

/** Only authored languages exist; anything else is a real 404, not a 200 stub. */
export const dynamicParams = false;

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ language: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { language } = await params;
  if (!catalog.some((entry) => entry.slug === language)) notFound();
  const { start } = await searchParams;
  return <HostedCourseWorkspace key={`${language}:${start ?? ""}`} initialLanguage={language} startNextLesson={start === "1"} />;
}
