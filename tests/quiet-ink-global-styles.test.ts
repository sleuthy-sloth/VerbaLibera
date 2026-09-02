import { readFile } from 'node:fs/promises';
import path from 'node:path';

describe('Quiet Ink global styles', () => {
  it('uses approved Quiet Ink tokens and font roles', async () => {
    // Break caught: the shared visual foundation reintroduces Signal Pop tokens or removes accessibility rules.
    const css = await readFile(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(css).toContain('--canvas: #f4f3ee');
    expect(css).toContain('--accent: #1e6563');
    expect(css).toContain('--font-display: var(--font-newsreader)');
    expect(css).toContain('--font-body: var(--font-instrument-sans)');
    expect(css).toContain('--font-utility: var(--font-ibm-plex-mono)');
    expect(css).not.toContain('--coral:');
    expect(css).not.toContain('radial-gradient');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
  });
});
