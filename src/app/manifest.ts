import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FantaFort — Fortnite Fantasy League',
    short_name: 'FantaFort',
    description: 'Create private fantasy leagues with Fortnite pro players and real FNCS results.',
    start_url: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  };
}
