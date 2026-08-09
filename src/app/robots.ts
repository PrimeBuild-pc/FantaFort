import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/admin', '/api/', '/auth', '/dashboard', '/friends', '/leaderboard', '/leagues', '/notifications', '/tournaments', '/trading', '/wallet'],
    },
    sitemap: 'https://fantafort.com/sitemap.xml',
    host: 'https://fantafort.com',
  };
}
