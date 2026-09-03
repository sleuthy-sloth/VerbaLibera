import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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
