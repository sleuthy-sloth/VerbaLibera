import italianMarketSections from "./generated/italian.json";
import frenchSections from "./generated/french.json";
import spanishIntroductions from "./generated/spanish.json";
import portugueseIntroductions from "./generated/portuguese.json";
import germanIntroductions from "./generated/german.json";
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
  {
    lessonId: "fr-identity-foundation",
    courseSlug: "french",
    lessonTitle: "Names and introductions",
    audioUrl: "/audio/french-foundations/fr-identity-listen.mp3",
    durationS: 600,
    sections: frenchSections,
  },
  {
    lessonId: "it-market-foundation",
    courseSlug: "italian",
    lessonTitle: "At the market: prices",
    audioUrl: "/audio/italian-foundations/it-market-listen.mp3",
    durationS: 600,
    reviewPending: true,
    sections: italianMarketSections,
  },
  spanishIntroductions,
  portugueseIntroductions,
  germanIntroductions,
];
export const trackForLesson = (lessonId: string) =>
  LISTEN_TRACKS.find((t) => t.lessonId === lessonId);
export const tracksForCourse = (courseSlug: string) =>
  LISTEN_TRACKS.filter((t) => t.courseSlug === courseSlug);
