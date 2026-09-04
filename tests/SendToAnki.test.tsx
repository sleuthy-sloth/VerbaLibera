import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SendToAnki } from '@/components/anki/SendToAnki';

describe('SendToAnki', () => {
  it('pushes the course deck and reports new vs duplicate counts', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { action: string };
      if (!body.action) return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
      calls.push(body.action);
      if (body.action === 'version') return { json: async () => ({ result: 6, error: null }) };
      if (body.action === 'modelNames') return { json: async () => ({ result: ['VerbaLibera'], error: null }) };
      if (body.action === 'addNotes') return { json: async () => ({ result: [1, null], error: null }) };
      return { json: async () => ({ result: 'ok', error: null }) };
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    render(<SendToAnki courseSlug="english-to-french" />);
    expect(screen.getByText(/Sends 56 cards/)).toBeInTheDocument();
    expect(screen.getByText(/2055492159/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send to Anki' }));
    expect(await screen.findByText(/1 new, 1 already there/)).toBeInTheDocument();
    expect(calls).toContain('createDeck');
    expect(calls).toContain('addNotes');
    vi.unstubAllGlobals();
  });

  it('tells the user to open Anki when it is unreachable', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('127.0.0.1')) throw new TypeError('fetch failed');
        return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
      }) as unknown as typeof fetch,
    );

    render(<SendToAnki courseSlug="english-to-italian" />);
    await user.click(screen.getByRole('button', { name: 'Send to Anki' }));
    expect(await screen.findByText(/Open Anki desktop first/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('renders nothing for an unknown course', () => {
    const { container } = render(<SendToAnki courseSlug="english-to-german" />);
    expect(container).toBeEmptyDOMElement();
  });
});
