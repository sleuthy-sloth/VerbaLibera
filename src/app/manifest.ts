import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'VerbaLibera',
    short_name: 'VerbaLibera',
    description: 'A calm daily practice path for practical language patterns.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f3ee',
    theme_color: '#f4f3ee',
    shortcuts: [
      { name: 'Today', url: '/' },
      { name: 'Resume session', url: '/learn/english-to-french' },
    ],
    icons: [
      { src: '/icons/verbalibera-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/verbalibera-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/verbalibera-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
