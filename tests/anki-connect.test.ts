import { describe, expect, it, vi } from 'vitest';
import { initialCourses } from '@/features/curriculum/fixture';
import { buildAnkiDeck } from '@/features/anki/notes';
import {
  AnkiUnavailableError,
  AnkiVersionError,
  pushDeckToAnki,
} from '@/features/anki/connect';

function mockFetch(handlers: Record<string, unknown>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { action: string; params: unknown };
    calls.push({ url, body });
    if (!(body.action in handlers)) throw new Error(`unexpected action ${body.action}`);
    const result = handlers[body.action];
    if (result instanceof Error) throw result;
    return { json: async () => ({ result, error: null }) };
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

describe('pushDeckToAnki', () => {
  it('runs the full flow: version → deck → model → media → notes', async () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const deck = buildAnkiDeck(course);
    const { fetchFn, calls } = mockFetch({
      version: 6,
      createDeck: 1,
      modelNames: ['Basic'],
      createModel: { ok: true },
      storeMediaFile: 'stored',
      addNotes: deck.notes.map((_, index) => (index < 10 ? 1000 + index : null)),
    });

    const result = await pushDeckToAnki(deck, {
      endpoint: 'http://127.0.0.1:8765',
      fetchFn,
      readMedia: async () => new Uint8Array([1, 2, 3]),
    });

    const actions = calls.map((call) => (call.body as { action: string }).action);
    expect(actions[0]).toBe('version');
    expect(actions[1]).toBe('createDeck');
    expect(actions[2]).toBe('modelNames');
    expect(actions[3]).toBe('createModel');
    expect(calls.filter((call) => (call.body as { action: string }).action === 'storeMediaFile')).toHaveLength(
      deck.media.length,
    );
    expect(actions.at(-1)).toBe('addNotes');
    expect(result).toMatchObject({ deckName: 'VoxLibre::French', added: 10, duplicates: 46, total: 56 });
  });

  it('skips createModel when the VoxLibre model already exists', async () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const { fetchFn, calls } = mockFetch({
      version: 6,
      createDeck: 1,
      modelNames: ['Basic', 'VoxLibre'],
      storeMediaFile: 'stored',
      addNotes: [],
    });
    await pushDeckToAnki(buildAnkiDeck(course), { fetchFn, readMedia: async () => new Uint8Array([0]) });
    expect(calls.some((call) => (call.body as { action: string }).action === 'createModel')).toBe(false);
  });

  it('sends stable ID fields and tags with every note', async () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const { fetchFn, calls } = mockFetch({
      version: 6,
      createDeck: 1,
      modelNames: ['VoxLibre'],
      storeMediaFile: 'stored',
      addNotes: [1],
    });
    await pushDeckToAnki(
      { ...buildAnkiDeck(course), notes: buildAnkiDeck(course).notes.slice(0, 1) },
      { fetchFn, readMedia: async () => new Uint8Array([0]) },
    );
    const addCall = calls.find((call) => (call.body as { action: string }).action === 'addNotes');
    const note = (addCall!.body as { params: { notes: Record<string, unknown>[] } }).params.notes[0]!;
    expect(note).toMatchObject({
      deckName: 'VoxLibre::French',
      modelName: 'VoxLibre',
      fields: {
        ID: 'voxlibre:fr-greet-politely:dialogue',
        Front: expect.stringContaining('Greet a shopkeeper'),
        Back: expect.stringContaining('Bonjour'),
      },
      options: { allowDuplicate: false },
      tags: ['voxlibre', 'english-to-french'],
    });
  });

  it('maps a closed Anki to AnkiUnavailableError and bad protocol to AnkiVersionError', async () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const deck = buildAnkiDeck(course);

    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(pushDeckToAnki(deck, { fetchFn: down })).rejects.toBeInstanceOf(AnkiUnavailableError);

    const { fetchFn } = mockFetch({ version: 5 });
    await expect(pushDeckToAnki(deck, { fetchFn })).rejects.toBeInstanceOf(AnkiVersionError);
  });

  it('names the failing media file when app media is unreadable', async () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const { fetchFn } = mockFetch({ version: 6, createDeck: 1, modelNames: ['VoxLibre'] });
    await expect(
      pushDeckToAnki(buildAnkiDeck(course), {
        fetchFn,
        readMedia: async (url) => {
          throw new Error(`no ${url}`);
        },
      }),
    ).rejects.toThrow('/audio/french/fr-greet-politely-prompt.wav');
  });
});
