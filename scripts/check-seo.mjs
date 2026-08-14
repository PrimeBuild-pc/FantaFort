import { readFile } from 'node:fs/promises';

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const publicPaths = ['/', '/how-it-works', '/it', '/es', '/de', '/fr', '/guides', '/guides/fncs-scoring-guide', '/it/guides/fncs-scoring-guide', '/players', '/players/peterbot', '/privacy', '/terms', '/cookies', '/credits', '/support'];
const privatePaths = ['/auth', '/dashboard', '/account', '/leagues', '/tournaments', '/wallet'];

for (const path of publicPaths) {
  const response = await fetch(`${base}${path}`);
  const html = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  for (const marker of ['<title>', 'rel="canonical"', 'name="description"']) {
    if (!html.includes(marker)) throw new Error(`${path}: missing ${marker}`);
  }
  if ((path==='/'||path==='/it')&&!html.includes('hrefLang="x-default"')) throw new Error(`${path}: missing hreflang set`);
}

for (const path of privatePaths) {
  const response = await fetch(`${base}${path}`);
  if (!response.headers.get('x-robots-tag')?.includes('noindex')) throw new Error(`${path}: missing X-Robots-Tag noindex`);
}

for (const path of ['/zz', '/zz/how-it-works', '/llms.txt']) {
  const response = await fetch(`${base}${path}`);
  if (response.status !== 404) throw new Error(`${path}: expected HTTP 404, got ${response.status}`);
}

const robots = await fetch(`${base}/robots.txt`).then(response => response.text());
if (!robots.includes('Sitemap: https://fantafort.com/sitemap.xml')) throw new Error('robots.txt: missing production sitemap');

const sitemap = await fetch(`${base}/sitemap.xml`).then(response => response.text());
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]));
if (!sitemapUrls.has('https://fantafort.com/')) throw new Error('sitemap.xml: homepage missing');
if (privatePaths.some(path => sitemapUrls.has(new URL(path, 'https://fantafort.com').href))) throw new Error('sitemap.xml: private URL included');

const supportPage = await readFile('src/app/support/page.tsx', 'utf8');
if (!supportPage.includes('DISCORD_INVITE_URL')) throw new Error('/support: missing verified Discord invitation');

console.log(`SEO checks passed for ${base}`);
