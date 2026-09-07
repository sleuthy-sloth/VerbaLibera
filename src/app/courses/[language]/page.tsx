import catalog from "@/features/course-pack/catalog.json";
import { notFound } from "next/navigation";
import { HostedCourseWorkspace } from "@/features/course-pack/HostedCourseWorkspace";
import "@/features/course-pack/study.css";
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
