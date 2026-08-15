import type { MetadataRoute } from 'next';
import { guideSlugs } from '@/lib/guides';
import { featuredPlayerIds } from '@/lib/public-players';

const site = 'https://fantafort.com';
const locales = ['it', 'es', 'de', 'fr'];

export default function sitemap(): MetadataRoute.Sitemap {
  // '/leaderboard' is intentionally excluded: it is noindex'd (X-Robots-Tag) and
  // disallowed in robots.txt because it requires an account to be useful, so
  // listing it here would contradict both.
  const core = ['/', '/how-it-works', '/players', '/methodology', '/about', '/privacy', '/terms', '/cookies', '/credits', '/support'];
  const localized = locales.flatMap(locale => [`/${locale}`, `/${locale}/how-it-works`]);
  const guides = ['/guides', '/it/guides', ...guideSlugs.flatMap(slug=>[`/guides/${slug}`,`/it/guides/${slug}`])];
  const players = featuredPlayerIds.map(id=>`/players/${id}`);
  return [...core, ...localized, ...guides, ...players].map(path => ({ url: `${site}${path}` }));
}
