import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chog Arena',
    short_name: 'Chog Arena',
    description: 'Your Chog is your fighter. Tap, build bots, battle in ranked seasons.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d0a18',
    theme_color: '#0d0a18',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
