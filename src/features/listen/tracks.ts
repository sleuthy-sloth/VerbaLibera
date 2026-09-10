import frenchTrack from "./generated/french.json";
import italianTrack from "./generated/italian.json";
import spanishTrack from "./generated/spanish.json";
import portugueseTrack from "./generated/portuguese.json";
import germanTrack from "./generated/german.json";
// Audio-only Thinking Method tracks. Each track is a static file synthesized
// at author time (never at runtime): a teacher guide plus target-language
// reveals with think-pauses baked in. Lessons without a track yet render an
// honest "being authored" state — never a placeholder player.
export type ListenSection = {
  heading: string;
  teacher: string;
  target?: { text: string; meaning: string };
};
export type ListenTrack = {
  lessonId: string;
  courseSlug: string;
  lessonTitle: string;
  audioUrl: string;
  durationS: number;
  reviewPending?: boolean;
  sections: ListenSection[];
};
export const LISTEN_TRACKS: ListenTrack[] = [
  frenchTrack,
  italianTrack,
  spanishTrack,
  portugueseTrack,
  germanTrack,
];
export const trackForLesson = (lessonId: string) =>
  LISTEN_TRACKS.find((t) => t.lessonId === lessonId);
export const tracksForCourse = (courseSlug: string) =>
  LISTEN_TRACKS.filter((t) => t.courseSlug === courseSlug);
