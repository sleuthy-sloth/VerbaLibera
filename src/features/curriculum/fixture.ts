import type { CourseFixture, ConceptFixture, DrillKind } from './types';

const unavailableAudio = (id: string) => `unavailable://original-demo/${id}`;

const frenchOrderingPilotAudio = {
  prompt: '/audio/french-ordering/fr-ordering-politely-prompt.wav',
  answer: '/audio/french-ordering/fr-ordering-politely-answer.wav',
} as const;

const frenchLessonAudio: Record<string, { prompt: string; answer: string }> = {
  'fr-greet-politely': { prompt: '/audio/french/fr-greet-politely-prompt.wav', answer: '/audio/french/fr-greet-politely-answer.wav' },
  'fr-find-place': { prompt: '/audio/french/fr-find-place-prompt.wav', answer: '/audio/french/fr-find-place-answer.wav' },
  'fr-ask-help': { prompt: '/audio/french/fr-ask-help-prompt.wav', answer: '/audio/french/fr-ask-help-answer.wav' },
  'fr-pay-politely': { prompt: '/audio/french/fr-pay-politely-prompt.wav', answer: '/audio/french/fr-pay-politely-answer.wav' },
  'fr-ask-directions': { prompt: '/audio/french/fr-ask-directions-prompt.wav', answer: '/audio/french/fr-ask-directions-answer.wav' },
  'fr-hotel-checkin': { prompt: '/audio/french/fr-hotel-checkin-prompt.wav', answer: '/audio/french/fr-hotel-checkin-answer.wav' },
  'fr-emergency-help': { prompt: '/audio/french/fr-emergency-help-prompt.wav', answer: '/audio/french/fr-emergency-help-answer.wav' },
};

const italianLessonAudio: Record<string, { prompt: string; answer: string }> = {
  'it-greet-politely': { prompt: '/audio/italian/it-greet-politely-prompt.wav', answer: '/audio/italian/it-greet-politely-answer.wav' },
  'it-find-place': { prompt: '/audio/italian/it-find-place-prompt.wav', answer: '/audio/italian/it-find-place-answer.wav' },
  'it-ask-help': { prompt: '/audio/italian/it-ask-help-prompt.wav', answer: '/audio/italian/it-ask-help-answer.wav' },
  'it-ordering-politely': { prompt: '/audio/italian/it-ordering-politely-prompt.wav', answer: '/audio/italian/it-ordering-politely-answer.wav' },
  'it-pay-politely': { prompt: '/audio/italian/it-pay-politely-prompt.wav', answer: '/audio/italian/it-pay-politely-answer.wav' },
  'it-ask-directions': { prompt: '/audio/italian/it-ask-directions-prompt.wav', answer: '/audio/italian/it-ask-directions-answer.wav' },
  'it-hotel-checkin': { prompt: '/audio/italian/it-hotel-checkin-prompt.wav', answer: '/audio/italian/it-hotel-checkin-answer.wav' },
  'it-emergency-help': { prompt: '/audio/italian/it-emergency-help-prompt.wav', answer: '/audio/italian/it-emergency-help-answer.wav' },
};

const spanishLessonAudio: Record<string, { prompt: string; answer: string }> = {
  'es-greet-politely': { prompt: '/audio/spanish/es-greet-politely-prompt.wav', answer: '/audio/spanish/es-greet-politely-answer.wav' },
  'es-ordering-politely': { prompt: '/audio/spanish/es-ordering-politely-prompt.wav', answer: '/audio/spanish/es-ordering-politely-answer.wav' },
  'es-find-place': { prompt: '/audio/spanish/es-find-place-prompt.wav', answer: '/audio/spanish/es-find-place-answer.wav' },
  'es-ask-help': { prompt: '/audio/spanish/es-ask-help-prompt.wav', answer: '/audio/spanish/es-ask-help-answer.wav' },
  'es-pay-politely': { prompt: '/audio/spanish/es-pay-politely-prompt.wav', answer: '/audio/spanish/es-pay-politely-answer.wav' },
  'es-ask-directions': { prompt: '/audio/spanish/es-ask-directions-prompt.wav', answer: '/audio/spanish/es-ask-directions-answer.wav' },
  'es-hotel-checkin': { prompt: '/audio/spanish/es-hotel-checkin-prompt.wav', answer: '/audio/spanish/es-hotel-checkin-answer.wav' },
  'es-emergency-help': { prompt: '/audio/spanish/es-emergency-help-prompt.wav', answer: '/audio/spanish/es-emergency-help-answer.wav' },
};

const lessonAudioFor = (id: string): { prompt: string; answer: string } | null => {
  if (id === 'fr-ordering-politely') return frenchOrderingPilotAudio;
  return frenchLessonAudio[id] ?? italianLessonAudio[id] ?? spanishLessonAudio[id] ?? null;
};

type PatternSeed = Readonly<{ id: string; scenario: string; notice: string; title: string; explanation: string; prompt: string; answer: string; drillPrompt: string; drillKind: DrillKind; acceptedResponses: readonly string[] }>;

const frenchPatterns: readonly PatternSeed[] = [
  { id: 'fr-greet-politely', scenario: 'Greeting politely', notice: 'A friendly greeting can introduce a polite request.', title: 'French: greeting politely with “Bonjour…”', explanation: 'Use “Bonjour, je voudrais…” to greet someone and begin a polite request.', prompt: 'Greet a shopkeeper and say you would like a table.', answer: 'Bonjour, je voudrais une table, s’il vous plaît.', drillPrompt: 'Now greet café staff and say you would like a coffee.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Bonjour, je voudrais un café, s’il vous plaît.'] },
  { id: 'fr-ordering-politely', scenario: 'Ordering coffee or food', notice: '“Je voudrais” makes a request sound courteous; change only the item.', title: 'French: ordering politely with “Je voudrais…”', explanation: 'Use “Je voudrais un café, s’il vous plaît.” to order a coffee politely in French.', prompt: 'You want to order a coffee politely in French. What do you say?', answer: 'Je voudrais un café, s’il vous plaît.', drillPrompt: 'Order a tea instead of a coffee.', drillKind: 'SUBSTITUTION', acceptedResponses: ['Je voudrais un thé, s’il vous plaît.'] },
  { id: 'fr-find-place', scenario: 'Finding a place', notice: 'Turn a place into a question with “Où est… ?”', title: 'French: asking where something is', explanation: 'Use “Où est la gare ?” to ask where a place is.', prompt: 'Ask where the station is in French.', answer: 'Où est la gare ?', drillPrompt: 'Turn “Le musée est ici.” into a question asking where the museum is.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Où est le musée ?'] },
  { id: 'fr-ask-help', scenario: 'Asking for help', notice: 'A polite question can ask someone directly for help.', title: 'French: asking for help politely', explanation: 'Use “Pouvez-vous m’aider ?” when you need help.', prompt: 'Ask someone politely if they can help you.', answer: 'Pouvez-vous m’aider ?', drillPrompt: 'Ask whether someone can show you the entrance.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Pouvez-vous me montrer l’entrée ?'] },
  { id: 'fr-pay-politely', scenario: 'Paying', notice: 'A short service request becomes polite with “s’il vous plaît.”', title: 'French: requesting the bill', explanation: 'Use “L’addition, s’il vous plaît.” to request the bill.', prompt: 'Ask for the bill politely in French.', answer: 'L’addition, s’il vous plaît.', drillPrompt: 'You have the bill; say that you would like to pay by card.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Je voudrais payer par carte, s’il vous plaît.'] },
  { id: 'fr-ask-directions', scenario: 'Asking for directions', notice: '“Pour aller à… ?” turns a destination into a direction question.', title: 'French: asking the way with “Pour aller à… ?”', explanation: 'Use “Pour aller à la gare, s’il vous plaît ?” to ask the way to the station.', prompt: 'Ask the way to the station in French.', answer: 'Pour aller à la gare, s’il vous plaît ?', drillPrompt: 'Now ask the way to the museum.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Pour aller au musée, s’il vous plaît ?'] },
  { id: 'fr-hotel-checkin', scenario: 'Checking in at a hotel', notice: '“J’ai une réservation…” states your booking clearly at reception.', title: 'French: checking in with “J’ai une réservation…”', explanation: 'Use “J’ai une réservation au nom de Martin.” to check in at a hotel.', prompt: 'Check in: say you have a reservation under the name Martin.', answer: 'Bonsoir, j’ai une réservation au nom de Martin.', drillPrompt: 'Now check in under the name Dupont.', drillKind: 'SUBSTITUTION', acceptedResponses: ['Bonsoir, j’ai une réservation au nom de Dupont.'] },
  { id: 'fr-emergency-help', scenario: 'Getting help in an emergency', notice: '“Au secours !” calls for urgent help; add what you need next.', title: 'French: calling for help with “Au secours !”', explanation: 'Use “Au secours ! Appelez une ambulance, s’il vous plaît.” in an emergency.', prompt: 'Call for help and ask someone to call an ambulance.', answer: 'Au secours ! Appelez une ambulance, s’il vous plaît.', drillPrompt: 'Now ask someone to call the police instead.', drillKind: 'SUBSTITUTION', acceptedResponses: ['Au secours ! Appelez la police, s’il vous plaît.'] },
];
const italianPatterns: readonly PatternSeed[] = [
  { id: 'it-greet-politely', scenario: 'Greeting politely', notice: 'A warm greeting can introduce a courteous request.', title: 'Italian: greeting politely with “Buongiorno…”', explanation: 'Use “Buongiorno, vorrei…” to greet someone and begin a polite request.', prompt: 'Greet a shopkeeper and say you would like a table.', answer: 'Buongiorno, vorrei un tavolo, per favore.', drillPrompt: 'Now greet café staff and say you would like a coffee.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Buongiorno, vorrei un caffè, per favore.'] },
  { id: 'it-ordering-politely', scenario: 'Ordering coffee or food', notice: '“Vorrei” makes a request courteous; change only the requested item.', title: 'Italian: ordering politely with “Vorrei…”', explanation: 'Use “Vorrei un caffè, per favore.” to order a coffee politely in Italian.', prompt: 'You want to order a coffee politely in Italian. What do you say?', answer: 'Vorrei un caffè, per favore.', drillPrompt: 'Order tea instead of coffee.', drillKind: 'SUBSTITUTION', acceptedResponses: ['Vorrei un tè, per favore.'] },
  { id: 'it-find-place', scenario: 'Finding a place', notice: 'Use “Dov’è… ?” to turn a place into a location question.', title: 'Italian: asking where something is', explanation: 'Use “Dov’è la stazione?” to ask where a place is.', prompt: 'Ask where the station is in Italian.', answer: 'Dov’è la stazione?', drillPrompt: 'Turn “Il museo è qui.” into a question asking where the museum is.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Dov’è il museo?'] },
  { id: 'it-ask-help', scenario: 'Asking for help', notice: 'A polite question can ask someone directly for assistance.', title: 'Italian: asking for help politely', explanation: 'Use “Può aiutarmi?” when you need help.', prompt: 'Ask someone politely if they can help you.', answer: 'Può aiutarmi?', drillPrompt: 'Ask whether someone can show you the entrance.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Può mostrarmi l’ingresso?'] },
  { id: 'it-pay-politely', scenario: 'Paying', notice: 'A short service request becomes polite with “per favore.”', title: 'Italian: requesting the bill', explanation: 'Use “Il conto, per favore.” to request the bill.', prompt: 'Ask for the bill politely in Italian.', answer: 'Il conto, per favore.', drillPrompt: 'You have the bill; say that you would like to pay by card.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Vorrei pagare con la carta, per favore.'] },
  { id: 'it-ask-directions', scenario: 'Asking for directions', notice: '“Per andare a… ?” turns a destination into a direction question.', title: 'Italian: asking the way with “Per andare a… ?”', explanation: 'Use “Per andare alla stazione, per favore?” to ask the way to the station.', prompt: 'Ask the way to the station in Italian.', answer: 'Per andare alla stazione, per favore?', drillPrompt: 'Now ask the way to the museum.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Per andare al museo, per favore?'] },
  { id: 'it-hotel-checkin', scenario: 'Checking in at a hotel', notice: '“Ho una prenotazione…” states your booking clearly at reception.', title: 'Italian: checking in with “Ho una prenotazione…”', explanation: 'Use “Ho una prenotazione a nome di Rossi.” to check in at a hotel.', prompt: 'Check in: say you have a reservation under the name Rossi.', answer: 'Buonasera, ho una prenotazione a nome di Rossi.', drillPrompt: 'Now check in under the name Bianchi.', drillKind: 'SUBSTITUTION', acceptedResponses: ['Buonasera, ho una prenotazione a nome di Bianchi.'] },
  { id: 'it-emergency-help', scenario: 'Getting help in an emergency', notice: '“Aiuto!” calls for urgent help; add what you need next.', title: 'Italian: calling for help with “Aiuto!”', explanation: 'Use “Aiuto! Chiami un’ambulanza, per favore.” in an emergency.', prompt: 'Call for help and ask someone to call an ambulance.', answer: 'Aiuto! Chiami un’ambulanza, per favore.', drillPrompt: 'Now ask someone to call the police instead.', drillKind: 'SUBSTITUTION', acceptedResponses: ['Aiuto! Chiami la polizia, per favore.'] },
];
const spanishPatterns: readonly PatternSeed[] = [
  { id: 'es-greet-politely', scenario: 'Greeting politely', notice: 'A friendly greeting can introduce a polite request.', title: 'Spanish: greeting politely with “Hola…”', explanation: 'Use “Hola, quisiera…” to greet someone and begin a polite request.', prompt: 'Greet a shopkeeper and say you would like a table.', answer: 'Hola, quisiera una mesa, por favor.', drillPrompt: 'Now greet café staff and say you would like a coffee.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Hola, quisiera un café, por favor.'] },
  { id: 'es-ordering-politely', scenario: 'Ordering coffee or food', notice: '“Quisiera” makes a request sound courteous; change only the item.', title: 'Spanish: ordering politely with “Quisiera…”', explanation: 'Use “Quisiera un café, por favor.” to order a coffee politely in Spanish.', prompt: 'You want to order a coffee politely in Spanish. What do you say?', answer: 'Quisiera un café, por favor.', drillPrompt: 'Order a tea instead of a coffee.', drillKind: 'SUBSTITUTION', acceptedResponses: ['Quisiera un té, por favor.'] },
  { id: 'es-find-place', scenario: 'Finding a place', notice: 'Turn a place into a question with “¿Dónde está… ?”', title: 'Spanish: asking where something is', explanation: 'Use “¿Dónde está la estación?” to ask where a place is.', prompt: 'Ask where the station is in Spanish.', answer: '¿Dónde está la estación?', drillPrompt: 'Turn “El museo está aquí.” into a question asking where the museum is.', drillKind: 'TRANSFORMATION', acceptedResponses: ['¿Dónde está el museo?'] },
  { id: 'es-ask-help', scenario: 'Asking for help', notice: 'A polite question can ask someone directly for help.', title: 'Spanish: asking for help politely', explanation: 'Use “¿Puede ayudarme, por favor?” when you need help.', prompt: 'Ask someone politely if they can help you.', answer: '¿Puede ayudarme, por favor?', drillPrompt: 'Ask whether someone can show you the entrance.', drillKind: 'TRANSFORMATION', acceptedResponses: ['¿Puede mostrarme la entrada, por favor?'] },
  { id: 'es-pay-politely', scenario: 'Paying', notice: 'A short service request becomes polite with “por favor.”', title: 'Spanish: requesting the bill', explanation: 'Use “La cuenta, por favor.” to request the bill.', prompt: 'Ask for the bill politely in Spanish.', answer: 'La cuenta, por favor.', drillPrompt: 'You have the bill; say that you would like to pay by card.', drillKind: 'TRANSFORMATION', acceptedResponses: ['Quisiera pagar con tarjeta, por favor.'] },
  { id: 'es-ask-directions', scenario: 'Asking for directions', notice: '“¿Para ir a… ?” turns a destination into a direction question.', title: 'Spanish: asking the way with “¿Para ir a… ?”', explanation: 'Use “¿Para ir a la estación, por favor?” to ask the way to the station.', prompt: 'Ask the way to the station in Spanish.', answer: '¿Para ir a la estación, por favor?', drillPrompt: 'Now ask the way to the museum.', drillKind: 'TRANSFORMATION', acceptedResponses: ['¿Para ir al museo, por favor?'] },
  { id: 'es-hotel-checkin', scenario: 'Checking in at a hotel', notice: '“Tengo una reserva…” states your booking clearly at reception.', title: 'Spanish: checking in with “Tengo una reserva…”', explanation: 'Use “Tengo una reserva a nombre de García.” to check in at a hotel.', prompt: 'Check in: say you have a reservation under the name García.', answer: 'Buenas noches, tengo una reserva a nombre de García.', drillPrompt: 'Now check in under the name López.', drillKind: 'SUBSTITUTION', acceptedResponses: ['Buenas noches, tengo una reserva a nombre de López.'] },
  { id: 'es-emergency-help', scenario: 'Getting help in an emergency', notice: '“¡Socorro!” calls for urgent help; add what you need next.', title: 'Spanish: calling for help with “¡Socorro!”', explanation: 'Use “¡Socorro! Llame a una ambulancia, por favor.” in an emergency.', prompt: 'Call for help and ask someone to call an ambulance.', answer: '¡Socorro! Llame a una ambulancia, por favor.', drillPrompt: 'Now ask someone to call the police instead.', drillKind: 'SUBSTITUTION', acceptedResponses: ['¡Socorro! Llame a la policía, por favor.'] },
];

const makeConcept = (language: string, position: number, seed: PatternSeed): ConceptFixture => {
  const pilotAudio = lessonAudioFor(seed.id);

  return {
  id: seed.id, position, cefrLevel: 'A1', title: seed.title, explanation: seed.explanation, scenario: seed.scenario, notice: seed.notice,
  modelDialogue: { prompt: seed.prompt, answer: seed.answer }, assessmentCriteria: `Say the full ${language} sentence for this travel situation without seeing the answer.`, contentProvenance: 'ORIGINAL',
  audioSegments: [
    { id: `${seed.id}-prompt`, type: 'PROMPT', position: 1, pauseAfter: true, audioUrl: pilotAudio?.prompt ?? unavailableAudio(`${seed.id}-prompt`), transcript: seed.prompt, contentProvenance: 'ORIGINAL' },
    { id: `${seed.id}-answer`, type: 'ANSWER', position: 2, pauseAfter: false, audioUrl: pilotAudio?.answer ?? unavailableAudio(`${seed.id}-answer`), transcript: seed.answer, contentProvenance: 'ORIGINAL' },
  ],
  drills: [{ id: `${seed.id}-drill`, conceptId: seed.id, cefrLevel: 'A1', kind: seed.drillKind, prompt: seed.drillPrompt, acceptedResponses: seed.acceptedResponses, recallTarget: seed.acceptedResponses[0] ?? seed.answer, contentProvenance: 'ORIGINAL' }],
  };
};
const makeCourse = (language: string, code: string, patterns: readonly PatternSeed[]): CourseFixture => ({
  slug: `english-to-${language}`, sourceLanguageCode: 'en', targetLanguageCode: code, title: `English to ${language[0]?.toUpperCase()}${language.slice(1)}: A1 patterns`, description: `Original A1 demonstrations for using practical ${language} patterns.`, concepts: patterns.map((pattern, index) => makeConcept(language, index + 1, pattern)),
});

export const initialCourses = [makeCourse('french', 'fr', frenchPatterns), makeCourse('italian', 'it', italianPatterns), makeCourse('spanish', 'es', spanishPatterns)] as const satisfies readonly CourseFixture[];
