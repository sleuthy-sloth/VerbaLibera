import manifest from '@/app/manifest';

describe('VoxLibre PWA manifest', () => {
  it('declares regular and maskable original Signal Pop icons', () => {
    // Break caught: installation metadata stops pointing at the committed app icons.
    const appManifest = manifest();

    expect(appManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/icons/voxlibre-192.png',
          sizes: '192x192',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: '/icons/voxlibre-512.png',
          sizes: '512x512',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: '/icons/voxlibre-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }),
      ]),
    );
  });
});
