import type { MetadataRoute } from 'next';
import { guideSlugs } from '@/lib/guides';
import { featuredPlayerIds } from '@/lib/public-players';

const site = 'https://fantafort.com';
const locales = ['it', 'es', 'de', 'fr'];

export default function sitemap(): MetadataRoute.Sitemap {
  const core = ['/', '/how-it-works', '/players', '/leaderboard', '/methodology', '/about', '/privacy', '/terms', '/cookies', '/credits', '/support'];
  const localized = locales.flatMap(locale => [`/${locale}`, `/${locale}/how-it-works`]);
  const guides = ['/guides', '/it/guides', ...guideSlugs.flatMap(slug=>[`/guides/${slug}`,`/it/guides/${slug}`])];
  const players = featuredPlayerIds.map(id=>`/players/${id}`);
  return [...core, ...localized, ...guides, ...players].map(path => ({ url: `${site}${path}` }));
}
