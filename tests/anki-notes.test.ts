import { describe, expect, it } from 'vitest';
import { initialCourses } from '@/features/curriculum/fixture';
import { buildAnkiDeck, deckNameFor } from '@/features/anki/notes';

describe('buildAnkiDeck', () => {
  it('builds 56 notes per course (8 dialogue + 8 recall + 8 listen + 32 vocab)', () => {
    for (const course of initialCourses) {
      const deck = buildAnkiDeck(course);
      const keys = deck.notes.map((note) => note.key);
      expect(deck.notes).toHaveLength(56);
      expect(keys.filter((key) => key.endsWith(':dialogue'))).toHaveLength(8);
      expect(keys.filter((key) => key.endsWith(':recall'))).toHaveLength(8);
      expect(keys.filter((key) => key.endsWith(':listen'))).toHaveLength(8);
      expect(keys.filter((key) => key.includes(':vocab:'))).toHaveLength(32);
    }
  });

  it('uses stable keys and deck names across rebuilds', () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const first = buildAnkiDeck(course);
    const second = buildAnkiDeck(course);
    expect(second.notes.map((note) => note.key)).toEqual(first.notes.map((note) => note.key));
    expect(first.deckName).toBe('VerbaLibera::French');
    expect(deckNameFor(initialCourses[3]!)).toBe('VerbaLibera::Portuguese');
  });

  it('embeds real audio via [sound:] tags and never leaks unavailable://', () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const deck = buildAnkiDeck(course);
    const serialized = JSON.stringify(deck);
    expect(serialized).not.toContain('unavailable://');
    expect(serialized).toContain('[sound:fr-greet-politely-answer.wav]');
    const audioFiles = deck.media.filter((entry) => entry.kind === 'audio');
    expect(audioFiles).toHaveLength(16);
  });

  it('builds image-front vocab cards with registry media', () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const deck = buildAnkiDeck(course);
    const vocab = deck.notes.filter((note) => note.key.endsWith(':vocab:museum'));
    expect(vocab.length).toBeGreaterThan(0);
    expect(vocab[0]!.front).toContain('<img src="museum.jpg"');
    expect(vocab[0]!.front).toContain('What is this in French?');
    expect(vocab[0]!.back).toBe('un musée');
    expect(deck.media.some((entry) => entry.filename === 'museum.jpg')).toBe(true);
  });

  it('dedupes shared media and skips builder drills', () => {
    const [course] = initialCourses;
    if (!course) throw new Error('missing fixture course');
    const deck = buildAnkiDeck(course);
    const filenames = deck.media.map((entry) => entry.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
    expect(deck.notes.some((note) => note.key.includes('-build'))).toBe(false);
  });
});
