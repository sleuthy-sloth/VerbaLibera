/**
 * The short first-win sequence (roadmap 1B).
 *
 * Phase 1A fixed the promise; this is the thing the promise was about. A new
 * learner who picks "Start from the beginning" is not dropped straight into
 * lesson 1 — they get one short, self-contained sequence first: hear a phrase,
 * recognise it, build it, optionally say it, and read a concrete recap of what
 * they just did.
 *
 * Three rules this module exists to enforce:
 *
 * 1. **It is preparation, not a lesson.** Nothing here writes practice events,
 *    attempts, evidence or lesson completion. `FirstWinFlow` takes no practice
 *    store at all, so it cannot. The recap says so in plain words.
 * 2. **Text-first, sound-optional.** Every step is complete without audio, and
 *    no step touches the microphone. The audio is the pack's own model clip,
 *    played only when the learner presses play — a failure to load it cannot
 *    block the sequence, and a learner with the sound off loses nothing.
 * 3. **The words come from the course.** Both sequences use the first lesson's
 *    own words and reuse the pack's existing model recording, so the welcome
 *    cannot drift from the course and adds no audio that would need a
 *    native-speaker pass of its own.
 *
 * Authored languages only: French and Italian, the two courses with a 25-lesson
 * foundation. `hasFirstWin` is the capability flag, the same shape as
 * `hasAuthoredPlacement` — Spanish, Portuguese and German get the language and
 * starting-point screens and go straight to lesson 1, as before.
 */

export type FirstWinStep =
  | Readonly<{
      phase: 'meet';
      prompt: string;
      /** The phrase itself, shown large. */
      phrase: string;
      meaning: string;
      note: string;
      /** A pack-owned recording. Optional by construction. */
      audioUrl: string;
      audioTranscript: string;
    }>
  | Readonly<{
      phase: 'recognize';
      prompt: string;
      options: readonly string[];
      answer: string;
      why: string;
      /** Shown when the learner picks something else, before they retry. */
      wrongNote: string;
    }>
  | Readonly<{
      phase: 'construct';
      prompt: string;
      /** Includes one distractor: building it should mean choosing. */
      tokens: readonly string[];
      answer: string;
      why: string;
      wrongNote: string;
    }>
  | Readonly<{
      phase: 'say';
      prompt: string;
      phrase: string;
      meaning: string;
      why: string;
    }>;

export type FirstWin = Readonly<{
  courseSlug: string;
  languageName: string;
  /** BCP-47 tag for the target-language text, so screen readers switch voice. */
  languageCode: string;
  /** What the learner can now say. The recap is built from this. */
  words: readonly Readonly<{ target: string; meaning: string }>[];
  steps: readonly FirstWinStep[];
  recap: Readonly<{ headline: string; body: string; notALesson: string }>;
}>;

const frenchFirstWin: FirstWin = {
  courseSlug: 'english-to-french',
  languageName: 'French',
  languageCode: 'fr',
  words: [
    { target: 'Bonjour', meaning: 'hello' },
    { target: 'merci', meaning: 'thank you' },
  ],
  steps: [
    {
      phase: 'meet',
      prompt: 'Start with the sound of it.',
      phrase: 'Bonjour',
      meaning: 'Hello. It works all day, not just in the morning.',
      note: 'The recording says the two words you are about to use. Press play, or read the transcript and carry on — nothing below needs the sound.',
      audioUrl: '/audio/french-foundations/fr-first-words-foundation-model.wav',
      audioTranscript: 'Bonjour, merci.',
    },
    {
      phase: 'recognize',
      prompt: 'You just heard Bonjour. What does it mean?',
      options: ['Hello.', 'Thank you.', 'Goodbye.'],
      answer: 'Hello.',
      why: 'Bonjour greets someone, and it holds all day — not just in the morning. Merci is thanks, and au revoir is what you say on the way out.',
      wrongNote: 'Not that one. Bonjour is the word that opens a conversation.',
    },
    {
      phase: 'construct',
      prompt: 'Greet them, then thank them. Two of these three words, in that order.',
      tokens: ['au revoir.', 'Bonjour,', 'merci.'],
      answer: 'Bonjour, merci.',
      why: 'That is the recording you just heard, word for word — and you built it yourself. The leftover word means goodbye.',
      wrongNote: 'Not the order you want yet. The greeting comes first.',
    },
    {
      phase: 'say',
      prompt: 'Say it out loud, once. Nobody is listening, and you can skip this.',
      phrase: 'Bonjour, merci.',
      meaning: 'Hello, thank you.',
      why: 'Saying it out loud is what makes it yours. If now is not the moment, skip — the lesson will ask again.',
    },
  ],
  recap: {
    headline: 'You just spoke French.',
    body: 'You heard Bonjour, merci, picked out the greeting, and built the pair yourself.',
    notALesson: 'This was a taste, not lesson 1. Your course still starts at the beginning, and nothing here counts as finished.',
  },
};

const italianFirstWin: FirstWin = {
  courseSlug: 'english-to-italian',
  languageName: 'Italian',
  languageCode: 'it',
  words: [
    { target: 'Ciao', meaning: 'hi — and bye' },
    { target: 'grazie', meaning: 'thank you' },
  ],
  steps: [
    {
      phase: 'meet',
      prompt: 'Start with the sound of it.',
      phrase: 'Ciao',
      meaning: 'Hi — and bye. It works when you arrive and when you leave.',
      note: 'The recording says the two words you are about to use. Press play, or read the transcript and carry on — nothing below needs the sound.',
      audioUrl: '/audio/italian-foundations/it-first-words-foundation-model.wav',
      audioTranscript: 'Ciao, grazie.',
    },
    {
      phase: 'recognize',
      prompt: 'You just heard Ciao. What does it mean?',
      options: ['Hi — and bye.', 'Thank you.', 'Good morning.'],
      answer: 'Hi — and bye.',
      why: 'Ciao covers both ends of a visit, which is why you hear it twice as often as you expect. Grazie is thanks; buongiorno is the polite hello for the daytime.',
      wrongNote: 'Not that one. Ciao is the word you can use twice in the same visit.',
    },
    {
      phase: 'construct',
      prompt: 'Say hello, then thank them. Two of these three words, in that order.',
      tokens: ['arrivederci.', 'grazie.', 'Ciao,'],
      answer: 'Ciao, grazie.',
      why: 'That is the recording you just heard, word for word — and you built it yourself. The leftover word is the formal goodbye.',
      wrongNote: 'Not the order you want yet. The greeting comes first.',
    },
    {
      phase: 'say',
      prompt: 'Say it out loud, once. Nobody is listening, and you can skip this.',
      phrase: 'Ciao, grazie.',
      meaning: 'Hi, thank you.',
      why: 'Saying it out loud is what makes it yours. If now is not the moment, skip — the lesson will ask again.',
    },
  ],
  recap: {
    headline: 'You just spoke Italian.',
    body: 'You heard Ciao, grazie, picked out the word for thanks, and built the pair yourself.',
    notALesson: 'This was a taste, not lesson 1. Your course still starts at the beginning, and nothing here counts as finished.',
  },
};

const FIRST_WINS: readonly FirstWin[] = [frenchFirstWin, italianFirstWin];

export function firstWinFor(courseSlug: string): FirstWin | null {
  return FIRST_WINS.find((firstWin) => firstWin.courseSlug === courseSlug) ?? null;
}

/** The capability flag. False means the flow skips straight past the sequence. */
export function hasFirstWin(courseSlug: string): boolean {
  return firstWinFor(courseSlug) !== null;
}

/** One-based step count, for "step 2 of 5" and for the tests to pin. */
export function firstWinStepCount(courseSlug: string): number {
  const firstWin = firstWinFor(courseSlug);
  // Four practice steps plus the recap the learner reads.
  return firstWin ? firstWin.steps.length + 1 : 0;
}
