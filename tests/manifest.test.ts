import manifest from '@/app/manifest';

describe('VerbaLibera PWA manifest', () => {
  it('describes the Quiet Ink standalone application', () => {
    // Break caught: installed clients no longer open with the Quiet Ink presentation metadata.
    expect(manifest()).toMatchObject({
      id: '/',
      start_url: '/',
      display: 'standalone',
      background_color: '#f4f3ee',
      theme_color: '#f4f3ee',
      description: 'A calm daily practice path for practical language patterns.',
      shortcuts: [
        { name: 'Today', url: '/' },
        { name: 'Resume session', url: '/learn/english-to-french' },
      ],
    });
  });

  it('declares regular and maskable VerbaLibera icons', () => {
    // Break caught: installation metadata stops pointing at the committed app icons.
    const appManifest = manifest();

    expect(appManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/icons/verbalibera-192.png',
          sizes: '192x192',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: '/icons/verbalibera-512.png',
          sizes: '512x512',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: '/icons/verbalibera-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }),
      ]),
    );
  });
});
