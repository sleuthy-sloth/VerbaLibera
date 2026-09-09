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
    "lessonId": "it-market-foundation",
    "courseSlug": "italian",
    "lessonTitle": "At the market: prices",
    "audioUrl": "/audio/italian-foundations/it-market-listen.mp3",
    "durationS": 450,
    "sections": [
      {
        "heading": "Welcome to the market",
        "teacher": "Welcome to today's walk through an Italian market. You already met numbers up to twenty in the foundations course, and today they go to work. In the next ten minutes you will buy fruit by the kilo, ask prices, and order politely, all by recombining a handful of blocks."
      },
      {
        "heading": "Numbers one to ten",
        "teacher": "First, a quick recap. One to ten in Italian. You know these cold, and everything today is priced and weighed with them. Listen once to lock them in.",
        "target": {
          "meaning": "One to ten.",
          "text": "Uno, due, tre, quattro, cinque, sei, sette, otto, nove, dieci."
        }
      },
      {
        "heading": "Numbers eleven to twenty",
        "teacher": "Now eleven to twenty. They stack onto ten the way English stacks teens. Notice seventeen and nineteen keep their full shape. Listen, because in two minutes these become prices.",
        "target": {
          "meaning": "Eleven to twenty.",
          "text": "Undici, dodici, tredici, quattordici, quindici, sedici, diciassette, diciotto, diciannove, venti."
        }
      },
      {
        "heading": "Un, una and market quantities",
        "teacher": "At an Italian market you buy quantities, not pieces. Two tiny words do the heavy lifting: a feminine word pairs with one of them, a masculine word with the other. Listen to how a kilo of apples is ordered. Next block: short for one hundred grams. Cold cuts and cheese sell by it. A hundred grams of ham. Listen to the pattern with apples, then ham.",
        "target": {
          "meaning": "A kilo of apples.",
          "text": "Un chilo di mele."
        }
      },
      {
        "heading": "Think: how much is one thing?",
        "teacher": "Now prices. How much does it cost, for one thing. Think. You are at the stall with one melon in your hand. Build the question yourself, then take ten seconds and say it in your head. Then listen to the reveal.",
        "target": {
          "meaning": "How much is a melon?",
          "text": "Quanto costa un melone?"
        }
      },
      {
        "heading": "Think: how much are many things?",
        "teacher": "Many things change exactly one word: it gains an n, meaning they cost. Think. A pile of peaches catches your eye. Ask the vendor their price, then listen.",
        "target": {
          "meaning": "How much are the peaches?",
          "text": "Quanto costano le pesche?"
        }
      },
      {
        "heading": "Hearing prices",
        "teacher": "Answers come back as numbers you already own. Listen and count with the vendor: three euros, that is four euros, five euros and fifty cents.",
        "target": {
          "meaning": "That is four euros.",
          "text": "Sono quattro euro."
        }
      },
      {
        "heading": "Vorrei, please and thanks",
        "teacher": "Now the politest verb in the market: I would like, softer than I want. Please opens every request, and thanks closes it. Listen to a full request.",
        "target": {
          "meaning": "I would like two hundred grams of ham, please.",
          "text": "Vorrei due etti di prosciutto, per favore."
        }
      },
      {
        "heading": "Courtesy first",
        "teacher": "Markets run on greetings: good morning, many thanks, goodbye, until tomorrow. Listen to each.",
        "target": {
          "meaning": "Good morning, thanks a lot!",
          "text": "Buongiorno, grazie mille!"
        }
      },
      {
        "heading": "Elena at the fruit stall",
        "teacher": "Time to put it together. A customer, Elena, at a fruit stall. She greets, the vendor answers, she orders a kilo of apples, and asks the price of the grapes. Listen to the whole exchange.",
        "target": {
          "meaning": "Good morning! I would like a kilo of apples, please.",
          "text": "Buongiorno! Vorrei un chilo di mele, per favore."
        }
      },
      {
        "heading": "Think: your turn as the customer",
        "teacher": "Now you are Elena. The vendor greets you. You want three apples. Build the polite request, then the grapes catch your eye: one kilo, so the singular question. Ten seconds for both lines, in your head, then listen.",
        "target": {
          "meaning": "I would like three apples, please.",
          "text": "Vorrei tre mele, per favore."
        }
      },
      {
        "heading": "Second stall: cheese",
        "teacher": "One more stall, cheese this time, and the vendor answers back. Two new half-blocks: a price sentence that needs no verb phrase of its own, and a short word that takes the feminine thing, while masculine things take another form. Listen to the whole exchange: question, price, deal. Final challenge, and nobody taught you this one. You are back at the fruit stall. One melon, masculine. Ask its price, singular, then take it, masculine. Twelve seconds, in your head, then listen. He names the price. Now close the deal. The melon is masculine, so the short word is the masculine one. Listen.",
        "target": {
          "meaning": "I will take it, thanks.",
          "text": "La prendo, grazie."
        }
      },
      {
        "heading": "Final challenge and close",
        "teacher": "One more review, mixing every block. Pears are feminine plural, and you want one kilo, so the masculine quantity word is right. A polite request, twelve seconds, in your head, then listen. And that is the market. Gender picks the little word for a and one. Kilo and hundred grams weigh it. One thing or many things changes the price verb. Please and thank you wrap every request in politeness, and the verb for taking closes the deal. A handful of blocks, and you derived every sentence today, including ones nobody taught you.",
        "target": {
          "meaning": "I will take it, thanks.",
          "text": "Lo prendo, grazie."
        }
      }
    ]
  },
];
export const trackForLesson = (lessonId: string) =>
  LISTEN_TRACKS.find((t) => t.lessonId === lessonId);
export const tracksForCourse = (courseSlug: string) =>
  LISTEN_TRACKS.filter((t) => t.courseSlug === courseSlug);
