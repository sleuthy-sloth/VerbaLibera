import type { AnkiDeck } from '@/features/anki/notes';
import { ANKI_MODEL_NAME } from '@/features/anki/notes';

export const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
export const ANKI_PROTOCOL_VERSION = 6;

export class AnkiUnavailableError extends Error {
  constructor() {
    super('Could not reach Anki. Open Anki desktop first, then try again.');
    this.name = 'AnkiUnavailableError';
  }
}

export class AnkiVersionError extends Error {
  constructor(version: unknown) {
    super(`AnkiConnect answered with protocol ${String(version)} — update the add-on, then try again.`);
    this.name = 'AnkiVersionError';
  }
}

type FetchFn = typeof fetch;

type PushDeps = {
  endpoint?: string;
  fetchFn?: FetchFn;
  /** Resolve app-relative media URL → raw bytes (injected for tests) */
  readMedia?: (sourceUrl: string) => Promise<Uint8Array>;
};

export type PushResult = Readonly<{ deckName: string; added: number; duplicates: number; total: number }>;

async function invoke(
  action: string,
  params: Record<string, unknown>,
  endpoint: string,
  fetchFn: FetchFn,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      body: JSON.stringify({ action, version: ANKI_PROTOCOL_VERSION, params }),
    });
  } catch {
    throw new AnkiUnavailableError();
  }
  let body: { result?: unknown; error?: unknown };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new AnkiUnavailableError();
  }
  if (body.error !== null && body.error !== undefined) {
    throw new Error(`Anki rejected ${action}: ${String(body.error)}`);
  }
  return body.result;
}

const MODEL_CSS = `.card { font-family: system-ui, sans-serif; font-size: 20px; text-align: center; }`;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function defaultReadMedia(sourceUrl: string, fetchFn: FetchFn): Promise<Uint8Array> {
  const response = await fetchFn(sourceUrl);
  if (!response.ok) throw new Error(`Could not read ${sourceUrl} (HTTP ${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * One-way push: ensure deck + model, store media, add notes.
 * Stable ID-field keys make re-pushes report duplicates instead of spamming.
 */
export async function pushDeckToAnki(deck: AnkiDeck, deps: PushDeps = {}): Promise<PushResult> {
  const endpoint = deps.endpoint ?? ANKI_CONNECT_URL;
  const fetchFn = deps.fetchFn ?? fetch;
  const readMedia = deps.readMedia ?? ((url: string) => defaultReadMedia(url, fetchFn));

  const version = await invoke('version', {}, endpoint, fetchFn);
  if (version !== ANKI_PROTOCOL_VERSION) throw new AnkiVersionError(version);

  await invoke('createDeck', { deck: deck.deckName }, endpoint, fetchFn);

  const models = (await invoke('modelNames', {}, endpoint, fetchFn)) as string[];
  if (!models.includes(deck.modelName)) {
    await invoke(
      'createModel',
      {
        modelName: deck.modelName,
        inOrderFields: ['ID', 'Front', 'Back'],
        css: MODEL_CSS,
        isCloze: false,
        cardTemplates: [
          {
            Name: 'Recall',
            Front: '{{Front}}',
            Back: '{{FrontSide}}\n<hr id="answer">\n{{Back}}',
          },
        ],
      },
      endpoint,
      fetchFn,
    );
  }

  for (const entry of deck.media) {
    let data: Uint8Array;
    try {
      data = await readMedia(entry.sourceUrl);
    } catch {
      throw new Error(`Could not read ${entry.sourceUrl} — is the app server still running?`);
    }
    await invoke('storeMediaFile', { filename: entry.filename, data: toBase64(data) }, endpoint, fetchFn);
  }

  const results = (await invoke(
    'addNotes',
    {
      notes: deck.notes.map((note) => ({
        deckName: deck.deckName,
        modelName: deck.modelName,
        fields: { ID: note.key, Front: note.front, Back: note.back },
        options: { allowDuplicate: false },
        tags: [...deck.tags],
      })),
    },
    endpoint,
    fetchFn,
  )) as Array<number | null>;

  const added = results.filter((id) => id !== null).length;
  return { deckName: deck.deckName, added, duplicates: results.length - added, total: results.length };
}

export { ANKI_MODEL_NAME };
