import italianMarketSections from "../../../services/voice/scripts/italian-market-listen.sections.json";
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
    durationS: 129,
    sections: [
      {
        heading: "Welcome",
        teacher:
          "Welcome to French, lesson one: names and introductions. You need nothing memorized. Everything in this lesson is built from two small words, and you already know a name: Anna.",
      },
      {
        heading: "Two words",
        teacher:
          "Je suis Anna means I am Anna. Two words do the work. Je means I. Suis means am. Say them in your head: Je... suis.",
        target: { text: "Je suis Anna.", meaning: "I am Anna." },
      },
      {
        heading: "Think: Marc",
        teacher:
          "Now think. Marc is introducing himself. How does he say, I am Marc? Pause the track if you need more time. Then listen. Je suis Marc. Same two blocks, a new name in the same slot. Names slide into the pattern without changing anything.",
        target: { text: "Je suis Marc.", meaning: "I am Marc." },
      },
      {
        heading: "Marie and Paul",
        teacher:
          "Next. Marie is a woman, and Paul is a man. Listen to how each one says, I am French.",
        target: { text: "Je suis française. / Je suis français.", meaning: "I am French (a woman / a man)." },
      },
      {
        heading: "One letter",
        teacher:
          "One letter carries the difference. The woman's word ends in e: française. The man's does not: français.",
      },
      {
        heading: "Think: Marie",
        teacher:
          "Think. Marie is telling someone she is French. Build her sentence, then listen. Je suis française. You combined two things you worked out minutes ago: the Je suis pattern, and the feminine e.",
        target: { text: "Je suis française.", meaning: "I am French (a woman)." },
      },
      {
        heading: "Transfer: Sophie",
        teacher:
          "Last one, and nobody taught you this sentence. Sophie is introducing herself. What does she say? Think. Je suis Sophie. You never practiced that sentence. You derived it. New situations, same few blocks. That is the whole method, and lesson one is done. The text practice in the app will lock it in.",
        target: { text: "Je suis Sophie.", meaning: "I am Sophie." },
      },
    ],
  },
  {
    lessonId: "it-market-foundation",
    courseSlug: "italian",
    lessonTitle: "At the market: prices",
    audioUrl: "/audio/italian-foundations/it-market-listen.mp3",
    durationS: 450,
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
