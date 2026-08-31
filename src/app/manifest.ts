import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VoxLibre',
    short_name: 'VoxLibre',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F7FF',
    theme_color: '#7068FF',
    icons: [
      { src: '/icons/voxlibre-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/voxlibre-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/voxlibre-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
