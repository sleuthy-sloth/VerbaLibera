import type { ConceptFixture } from './types';

export type TeachingNote = Readonly<{
  meaning: string;
  explanation: string;
  pieces: readonly (readonly [string, string])[];
  tip: string;
}>;

// Original instructional notes. Keep translations and grammar guidance authored,
// separate from answer checking: learners can study freely before retrieval.
const french: Record<string, TeachingNote> = {
  'greet-politely': { meaning: 'Hello, I would like a table, please.', explanation: 'Start with Bonjour to acknowledge the person. Je voudrais means “I would like”: learn it as a useful polite request. Add what you want, then s’il vous plaît. You do not need to conjugate a new verb when you change the item.', pieces: [['Bonjour', 'Hello'], ['je voudrais', 'I would like'], ['une table', 'a table'], ['s’il vous plaît', 'please']], tip: 'Keep the article with its noun: une table, but un café. French nouns have grammatical gender.' },
  'ordering-politely': { meaning: 'I would like a coffee, please.', explanation: 'Je voudrais is a polite way to ask for something. The order is request + item + please. To order something else, replace the noun phrase while keeping the request intact.', pieces: [['Je voudrais', 'I would like'], ['un café', 'a coffee'], ['un thé', 'a tea'], ['s’il vous plaît', 'please']], tip: 'Un café and un thé both use un. Learn each new noun together with its article.' },
  'find-place': { meaning: 'Where is the station?', explanation: 'Où means “where” and est means “is.” Put them before the place: Où est + place? The accent on où distinguishes “where” from ou, meaning “or.”', pieces: [['Où', 'Where'], ['est', 'is'], ['la gare', 'the station'], ['le musée', 'the museum']], tip: 'Keep the place’s article: la gare becomes Où est la gare ?' },
  'ask-help': { meaning: 'Can you help me?', explanation: 'Pouvez-vous is a polite “can you?” question. The action comes after it in the infinitive: aider, to help. In m’aider, m’ means “me” and sits before the action.', pieces: [['Pouvez-vous', 'Can you (polite/plural)'], ['m’aider', 'help me'], ['me montrer', 'show me'], ['l’entrée', 'the entrance']], tip: 'Me becomes m’ before a vowel sound: me + aider → m’aider.' },
  'pay-politely': { meaning: 'The bill, please.', explanation: 'A short noun phrase is enough in this restaurant situation: l’addition + s’il vous plaît. To describe how you want to pay, reuse je voudrais and add the action payer.', pieces: [['L’addition', 'The bill'], ['s’il vous plaît', 'please'], ['payer', 'to pay'], ['par carte', 'by card']], tip: 'Je voudrais can introduce a noun (un café) or an infinitive action (payer).' },
  'ask-directions': { meaning: 'How do I get to the station, please?', explanation: 'Pour aller à… literally begins “to go to…” and works as a short request for directions. With a masculine place, à + le contracts to au. With la, keep à la.', pieces: [['Pour aller', 'To go'], ['à la gare', 'to the station'], ['au musée', 'to the museum'], ['s’il vous plaît', 'please']], tip: 'Say au musée, not à le musée. This is a required contraction.' },
  'hotel-checkin': { meaning: 'Good evening, I have a reservation under the name Martin.', explanation: 'J’ai means “I have.” Follow it with une réservation, then au nom de and the booking name. To use your own name, replace Martin; the sentence frame stays the same.', pieces: [['Bonsoir', 'Good evening'], ['j’ai', 'I have'], ['une réservation', 'a reservation'], ['au nom de', 'under the name of']], tip: 'Je + ai contracts to j’ai. Keep the apostrophe when writing it.' },
  'emergency-help': { meaning: 'Help! Call an ambulance, please.', explanation: 'Au secours ! is an urgent call for help. Appelez is a direct instruction addressed politely or to several people. Add the service you need after the verb.', pieces: [['Au secours !', 'Help!'], ['Appelez', 'Call'], ['une ambulance', 'an ambulance'], ['la police', 'the police']], tip: 'In an urgent situation, start with Au secours ! Then state the action clearly.' },
};

const requests: Record<string, TeachingNote> = {
  it: { meaning: 'Hello, I would like a table, please.', explanation: 'Buongiorno opens a polite conversation. Vorrei means “I would like.” Put the item after it and finish with per favore. Changing the item gives you a new useful sentence.', pieces: [['Buongiorno', 'Hello / good morning'], ['vorrei', 'I would like'], ['un tavolo', 'a table'], ['un caffè', 'a coffee'], ['per favore', 'please']], tip: 'Italian articles belong with their nouns. Learn un tavolo and un caffè as complete phrases.' },
  es: { meaning: 'Hello, I would like a table, please.', explanation: 'Hola greets the person. Quisiera is a polite “I would like.” Add the item and por favor. Notice that una mesa uses una, while un café uses un.', pieces: [['Hola', 'Hello'], ['quisiera', 'I would like'], ['una mesa', 'a table'], ['un café', 'a coffee'], ['por favor', 'please']], tip: 'Keep the article with the noun when you substitute: una mesa → un café.' },
  pt: { meaning: 'Hello, I would like a table, please.', explanation: 'Olá greets the person. Eu gostaria de means “I would like.” Keep de before the item, then finish with por favor. Replace the item to make a new request.', pieces: [['Olá', 'Hello'], ['eu gostaria de', 'I would like'], ['uma mesa', 'a table'], ['um café', 'a coffee'], ['por favor', 'please']], tip: 'Learn the article with the noun: uma mesa, but um café.' },
};

export function teachingFor(concept: ConceptFixture): TeachingNote {
  const code = concept.id.slice(0, 2);
  const pattern = concept.id.slice(3);
  if (code === 'fr' && french[pattern]) return french[pattern];
  if (pattern === 'greet-politely' && requests[code]) return requests[code];
  if (notes[concept.id]) {
    const [explanation, pieces, tip] = notes[concept.id];
    return { meaning: concept.modelDialogue.prompt, explanation, pieces, tip };
  }
  return {
    meaning: concept.modelDialogue.prompt,
    explanation: concept.explanation + ' Read the complete model, listen if audio is available, and say it slowly. Then study how the worked example changes the sentence for another situation.',
    pieces: [[concept.modelDialogue.answer, 'Model for this situation'], [concept.drills[0]?.recallTarget ?? '', 'Variation to study before practice']],
    tip: concept.notice,
  };
}

// Phrase-by-phrase support for the other original travel courses.
const notes: Record<string, readonly [string, readonly (readonly [string, string])[], string]> = {
  'it-ordering-politely': ['Vorrei means “I would like.” Keep this request frame and replace just the item. Per favore turns the sentence into a courteous service request.', [['Vorrei', 'I would like'], ['un caffè', 'a coffee'], ['un tè', 'a tea'], ['per favore', 'please']], 'Keep the written accents on caffè and tè.'],
  'it-find-place': ['Dov’è joins dove (where) and è (is). Put the place after this question opening. Learn the place with its article so you can substitute it accurately.', [['Dov’è', 'Where is'], ['la stazione', 'the station'], ['il museo', 'the museum']], 'Use the apostrophe and the accent in dov’è.'],
  'it-ask-help': ['Può is the polite singular “can you” here. In aiutarmi, the infinitive aiutare (to help) loses its final e before mi (me) is attached.', [['Può', 'Can you (polite)'], ['aiutarmi', 'help me'], ['mostrarmi', 'show me'], ['l’ingresso', 'the entrance']], 'Change the action, not the polite opening: Può aiutarmi? → Può mostrarmi…?'],
  'it-pay-politely': ['Il conto names the restaurant bill. Per favore is enough to make this short request polite. For a payment method, use vorrei + pagare (to pay).', [['Il conto', 'The bill'], ['per favore', 'please'], ['pagare', 'to pay'], ['con la carta', 'by card']], 'Vorrei can be followed by an item or an infinitive action.'],
  'it-ask-directions': ['Per andare means “to go.” Add the destination with a. Italian combines a with the article: a + la → alla, and a + il → al.', [['Per andare', 'To go'], ['alla stazione', 'to the station'], ['al museo', 'to the museum']], 'Changing the destination can change the preposition: alla stazione → al museo.'],
  'it-hotel-checkin': ['Ho means “I have”; Italian usually leaves out the subject io here. Add una prenotazione (a reservation), then a nome di and the booking name.', [['Buonasera', 'Good evening'], ['ho', 'I have'], ['una prenotazione', 'a reservation'], ['a nome di', 'under the name of']], 'The h in ho is silent, but it is required in writing.'],
  'it-emergency-help': ['Aiuto! gets attention in an emergency. Chiami is a polite singular instruction: “call.” Put the service you need immediately after it.', [['Aiuto!', 'Help!'], ['Chiami', 'Call (polite)'], ['un’ambulanza', 'an ambulance'], ['la polizia', 'the police']], 'Una becomes un’ before the vowel in ambulanza.'],
  'es-ordering-politely': ['Quisiera is a polite way to say “I would like.” Put the item after it and finish with por favor. The same frame works for many café orders.', [['Quisiera', 'I would like'], ['un café', 'a coffee'], ['un té', 'a tea'], ['por favor', 'please']], 'Café and té have written accents. Learn those with the words.'],
  'es-find-place': ['Dónde means “where.” Use está for the location of a place, then name it with its article. Spanish marks both the beginning and the end of a question.', [['Dónde', 'Where'], ['está', 'is located'], ['la estación', 'the station'], ['el museo', 'the museum']], 'Write ¿Dónde está…? with both question marks and the accents.'],
  'es-ask-help': ['Puede is a polite “can you” here. Ayudarme combines ayudar (to help) and me. Keep puede and change the action to ask someone to show you something.', [['Puede', 'Can you (polite)'], ['ayudarme', 'help me'], ['mostrarme', 'show me'], ['la entrada', 'the entrance']], 'The infinitive keeps its final r when me is attached: ayudar + me → ayudarme.'],
  'es-pay-politely': ['La cuenta means the bill in a restaurant. Por favor completes the short request. To say how you want to pay, add pagar after quisiera.', [['La cuenta', 'The bill'], ['por favor', 'please'], ['pagar', 'to pay'], ['con tarjeta', 'by card']], 'This payment phrase uses con tarjeta without an article.'],
  'es-ask-directions': ['Para ir means “to go.” Add a and the destination. Before masculine el, a contracts to al. Before feminine la, the two words stay separate.', [['Para ir', 'To go'], ['a la estación', 'to the station'], ['al museo', 'to the museum']], 'Use al museo, not a el museo.'],
  'es-hotel-checkin': ['Tengo means “I have.” Spanish often omits yo (I) because the verb shows the person. Add una reserva and a nombre de, then your booking name.', [['Buenas noches', 'Good evening / good night'], ['tengo', 'I have'], ['una reserva', 'a reservation'], ['a nombre de', 'under the name of']], 'Replace only the name to use this sentence at reception.'],
  'es-emergency-help': ['¡Socorro! calls for urgent help. Llame is a polite instruction to one person. Follow it with the service you need them to contact.', [['Socorro', 'Help'], ['Llame', 'Call (polite)'], ['a una ambulancia', 'for an ambulance'], ['a la policía', 'the police']], 'Spanish uses opening and closing exclamation marks: ¡Socorro!'],
  'pt-ordering-politely': ['Eu gostaria de means “I would like.” Gostaria needs de before the item or action in this pattern. Keep de when you replace coffee with tea.', [['Eu gostaria de', 'I would like'], ['um café', 'a coffee'], ['um chá', 'a tea'], ['por favor', 'please']], 'Do not drop de: gostaria de um café, gostaria de pagar.'],
  'pt-find-place': ['Onde asks “where.” Fica is commonly used for where a place is located. Put the place after onde fica, keeping its article.', [['Onde', 'Where'], ['fica', 'is located'], ['a estação', 'the station'], ['o museu', 'the museum']], 'Estação uses the feminine article a; museu uses masculine o.'],
  'pt-ask-help': ['Você pode means “you can,” or “can you?” in a question. In this Brazilian Portuguese pattern, me comes before ajudar (help) or mostrar (show).', [['Você pode', 'Can you'], ['me ajudar', 'help me'], ['me mostrar', 'show me'], ['a entrada', 'the entrance']], 'This course uses Brazilian phrasing here; European Portuguese often places the pronoun differently.'],
  'pt-pay-politely': ['A conta names the restaurant bill. Finish the short request with por favor. For a payment method, use eu gostaria de + pagar (to pay).', [['A conta', 'The bill'], ['por favor', 'please'], ['pagar', 'to pay'], ['com cartão', 'by card']], 'Keep de after gostaria, even when an action follows.'],
  'pt-ask-directions': ['Para ir means “to go.” The preposition a combines with the place’s article: a + a → à, and a + o → ao. The destination determines which form you use.', [['Para ir', 'To go'], ['à estação', 'to the station'], ['ao museu', 'to the museum']], 'The grave accent in à marks this contraction. It is different from a plain a.'],
  'pt-hotel-checkin': ['Tenho means “I have”; the subject eu can be omitted. Follow it with uma reserva and no nome de, then the name on the booking.', [['Boa noite', 'Good evening / good night'], ['tenho', 'I have'], ['uma reserva', 'a reservation'], ['no nome de', 'under the name of']], 'To personalize the sentence, change the booking name and keep the rest of the frame.'],
  'pt-emergency-help': ['Socorro! is an urgent call for help. Chame is an instruction addressed to você. Add the service you need after the verb.', [['Socorro!', 'Help!'], ['Chame', 'Call'], ['uma ambulância', 'an ambulance'], ['a polícia', 'the police']], 'Say the urgent request first; por favor can follow it.'],
};
