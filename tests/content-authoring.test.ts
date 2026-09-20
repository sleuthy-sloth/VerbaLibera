import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { normalizePack } from '@/features/course-pack/normalize-pack';
import type { RuntimePack } from '@/features/course-pack/lesson-runtime';
import { buildCourseOutcomes } from '../scripts/content/outcomes';
import { readProseReview } from '../scripts/content/review';

describe('content authoring guide (Task 9)', () => {
  it('docs/content-authoring.md exists and mentions Kokoro, sha256, unavailable://, and the reconcile script', () => {
    const p = path.join(process.cwd(), 'docs/content-authoring.md');
    expect(fs.existsSync(p), 'expected docs/content-authoring.md to exist').toBe(true);
    const content = fs.readFileSync(p, 'utf8');
    const lower = content.toLowerCase();

    // Must mention the technologies and guardrails so future contributors
    // can find and follow the recipe.
    expect(lower).toContain('kokoro');
    expect(lower).toContain('sha256');
    expect(lower).toContain('unavailable://');
    expect(lower).toContain('reconcile_provenance');
  });

  it('docs/audio-provenance/README.md exists and lists every shipped manifest', () => {
    const p = path.join(process.cwd(), 'docs/audio-provenance/README.md');
    expect(fs.existsSync(p), 'expected docs/audio-provenance/README.md to exist').toBe(true);
    const content = fs.readFileSync(p, 'utf8');
    expect(content).toContain('french-ordering-pilot.json');
    expect(content).toContain('italian-patterns.json');
    expect(content).toContain('french-polish.json');
  });
});

/**
 * The complete-unit contract.
 *
 * What these tests are protecting is not the arithmetic — it is the honesty
 * rules: a structural check must never imply the language is correct, a unit with
 * review open must stay publishable, and an absence must be reported rather than
 * thrown so a pack that needs work still validates.
 */
describe('the complete-unit contract reports state without claiming correctness', () => {
  const LANGUAGES = ['french', 'german', 'italian', 'portuguese', 'spanish'] as const;
  const ITEMS = [
    'communicative objective',
    'prerequisite concepts and vocabulary',
    'introduced and later-retrieved vocabulary and patterns',
    'recognition practice',
    'target-language production',
    'listening practice and referenced media',
    'optional self-compare speaking',
    'lesson-family variety',
    'prose-review state',
    'audio-listening-review state',
    'media provenance and integrity',
    'web, offline-download and portable compatibility',
  ];
  const STATES = ['present', 'absent', 'pending-review', 'not-applicable'];

  const packOf = (language: string): RuntimePack =>
    normalizePack(JSON.parse(fs.readFileSync(path.join('courses', language, 'manifest.json'), 'utf8')));
  const courseOf = (language: string) => buildCourseOutcomes(packOf(language), readProseReview(language));

  it.each(LANGUAGES)('%s reports every item of the contract, per unit', (language) => {
    const course = courseOf(language);
    expect(course.contracts).toHaveLength(course.units);
    for (const contract of course.contracts) {
      expect(contract.items.map((entry) => entry.item)).toEqual(ITEMS);
      for (const entry of contract.items) {
        expect(STATES, `${language}/${contract.unitId}: ${entry.item}`).toContain(entry.state);
        // Every state names what it checked, so a reader cannot read "present" as
        // a judgement about the language.
        expect(entry.basis.length, `${entry.item} names its basis`).toBeGreaterThan(40);
      }
      // The unit's lessons are the rows it was derived from.
      expect(contract.lessons.length).toBeGreaterThan(0);
    }
  });

  it('never calls a review present without the record to back it', () => {
    const german = courseOf('german');
    const spanish = courseOf('spanish');
    const italian = courseOf('italian');
    const stateOf = (language: ReturnType<typeof courseOf>, item: string): string =>
      language.contracts[0]!.items.find((entry) => entry.item === item)!.state;

    // German's record says part reviewed, so neither unit counts as reviewed.
    expect(stateOf(german, 'prose-review state')).toBe('pending-review');
    expect(german.contracts.every((contract) => !contract.countsAsReviewed)).toBe(true);
    // Spanish was reported reviewed; its listening review still is not.
    expect(stateOf(spanish, 'prose-review state')).toBe('present');
    expect(spanish.contracts.every((contract) => contract.countsAsReviewed)).toBe(true);
    expect(stateOf(spanish, 'audio-listening-review state')).toBe('pending-review');
    // Italian is unreviewed, and that does not stop it being publishable.
    expect(stateOf(italian, 'prose-review state')).toBe('pending-review');
    expect(italian.contracts.every((contract) => contract.publishable)).toBe(true);
    expect(italian.contracts.every((contract) => !contract.countsAsReviewed)).toBe(true);
  });

  it('reserves not-applicable for cases that really are, rather than for absences', () => {
    const german = courseOf('german');
    const italian = courseOf('italian');
    const stateOf = (course: ReturnType<typeof courseOf>, unitId: string, item: string): string =>
      course.contracts.find((contract) => contract.unitId === unitId)!.items.find((entry) => entry.item === item)!.state;

    // The first unit owes no prerequisites, and the last unit cannot be retrieved later.
    expect(stateOf(german, german.contracts[0]!.unitId, 'prerequisite concepts and vocabulary')).toBe('not-applicable');
    expect(stateOf(german, german.contracts.at(-1)!.unitId, 'introduced and later-retrieved vocabulary and patterns')).toBe('not-applicable');
    // German authors no speaking anywhere: a stated position, not a missing check.
    expect(german.contracts.every((c) => c.items.find((i) => i.item === 'optional self-compare speaking')!.state === 'not-applicable')).toBe(true);
    // Italian does author speaking, so its units answer with present or absent.
    for (const contract of italian.contracts) {
      const speaking = contract.items.find((entry) => entry.item === 'optional self-compare speaking')!;
      expect(['present', 'absent']).toContain(speaking.state);
    }
  });

  it('names absences as warnings and still builds, rather than failing a pack', () => {
    const german = courseOf('german');
    const first = german.contracts[0]!;
    // German's listening gap is real and reported, and the unit is still publishable.
    expect(first.items.find((entry) => entry.item === 'listening practice and referenced media')!.state).toBe('absent');
    expect(first.warnings.some((warning) => warning.includes('no listening practice'))).toBe(true);
    expect(first.publishable).toBe(true);
    // No contract item is ever an exception: every pack produced one for every unit.
    for (const language of LANGUAGES) expect(courseOf(language).contracts.length).toBeGreaterThan(0);
  });

  it('catches a dangling media reference without throwing', () => {
    // Non-vacuity. Strip the pack's media and the units that referenced clips must
    // report the absence structurally: provenance absent, a warning naming the
    // problem, and a build that still finished.
    const pack = packOf('italian');
    expect(() => buildCourseOutcomes({ ...pack, media: [] }, readProseReview('italian'))).not.toThrow();
    const stripped = buildCourseOutcomes({ ...pack, media: [] }, readProseReview('italian'));
    for (const contract of stripped.contracts) {
      const provenance = contract.items.find((entry) => entry.item === 'media provenance and integrity')!;
      const listening = contract.items.find((entry) => entry.item === 'listening practice and referenced media')!;
      if (contract.warnings.some((warning) => warning.includes('not declared'))) {
        expect(provenance.state).toBe('absent');
        expect(listening.state).toBe('absent');
        expect(contract.publishable).toBe(false);
      }
    }
    // The untouched pack is unaffected, so the check is reading the pack and not a constant.
    expect(courseOf('italian').contracts.some((c) => c.publishable)).toBe(true);
  });

  it('renders the contract into the generated matrix', () => {
    const document = fs.readFileSync(path.join('docs', 'curriculum-matrix.md'), 'utf8');
    const germans = courseOf('german');
    expect(document).toContain('#### Unit contract');
    expect(document.match(/#### Unit contract/g) ?? []).toHaveLength(
      LANGUAGES.reduce((total, language) => total + courseOf(language).contracts.length, 0),
    );
    for (const contract of germans.contracts)
      expect(document).toContain(`- publishable: ${contract.publishable ? 'yes' : 'no'}`);
  });

  it('documents the contract where an author will look for it', () => {
    const guide = fs.readFileSync(path.join('docs', 'content-authoring.md'), 'utf8');
    for (const item of ITEMS) expect(guide).toContain(item);
    expect(guide).toContain('not-applicable');
    expect(guide).toContain('publishable');
    // The rule that matters most: structure is not a language judgement.
    expect(guide.toLowerCase()).toMatch(/never a judgement about the language|not a judgement about the language|does not claim/);
  });
});
