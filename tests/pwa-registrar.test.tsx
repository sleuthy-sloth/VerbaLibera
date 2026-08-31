import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PwaRegistrar } from '@/components/pwa/PwaRegistrar';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PwaRegistrar', () => {
  it('registers the conservative static worker in a browser that supports service workers', () => {
    // Break caught: installed clients no longer receive the static offline fallback.
    const register = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { serviceWorker: { register } });

    render(<PwaRegistrar />);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('does not throw when service workers are unavailable', () => {
    // Break caught: unsupported browsers cannot render the application shell.
    vi.stubGlobal('navigator', {});

    expect(() => render(<PwaRegistrar />)).not.toThrow();
  });
});
