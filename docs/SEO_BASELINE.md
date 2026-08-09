# FantaFort SEO baseline

Captured on 18 July 2026 before the SEO implementation.

## Live production evidence

- `https://fantafort.com/` returned HTTP 200 with no redirect.
- Canonical host redirects were already configured for `www.fantafort.com` and `fantafort.vercel.app`.
- `/robots.txt` and `/sitemap.xml` returned HTTP 404.
- `/auth`, `/dashboard`, `/account` and other private application routes returned indexable HTTP 200 responses without `X-Robots-Tag`.
- The root HTML declared `lang="it"`, while its visible landing content was English.
- Only a global title and description were present; route-specific canonical, hreflang, social metadata and structured data were missing.
- The rendered homepage exposed very little descriptive content.
- Security headers and HTTPS/HSTS were already active on Vercel.

## Main implementation decisions

- English remains the unprefixed default; Italian, Spanish, German and French use crawlable locale prefixes.
- Private/game routes are excluded through `X-Robots-Tag` and robots rules.
- Public acquisition pages use server-rendered content and native Next.js metadata.
- Only English and Italian guides are published initially. Other translations must be reviewed before indexation.
- Player profile pages are not generated until each page can expose enough verified, unique competitive data.
- No FAQ rich-result markup, fake ratings, speculative biographies or mass-generated player pages.
- No analytics or marketing cookies were added.

## External research follow-up

Live SERP validation was completed on 18 July 2026 after Brave Search access was configured. The research sampled 70 localized queries and 700 top-10 results across the US, Italy, Spain, Germany and France. Brave provides neither reliable search volume nor keyword difficulty; the validated intent decisions and this limitation are recorded in `docs/SEO_KEYWORD_MAP.md`.

FantaFort was absent from the sampled top 10 results, and Brave returned no result for `site:fantafort.com` immediately after sitemap submission. Treat this as the initial indexing baseline and recheck after at least 28 days of Search Console data.

## Local post-implementation lab check

Lighthouse on the production build served locally scored Performance 93 and Accessibility 100; after correcting generic link text, the final SEO score was 100. Lab metrics were LCP 3.1–3.2 s, CLS 0 and TBT 50–70 ms. Google PageSpeed Insights returned a public API rate-limit response, so production field data remains pending after deployment.

## Success thresholds

- Indexable URLs: HTTP 200, self-canonical, unique metadata and present in the sitemap.
- Private URLs: `X-Robots-Tag: noindex, nofollow` and absent from the sitemap.
- Hreflang: self-reference, return links and `x-default` for every translated set.
- Core Web Vitals at p75: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.
- No structured-data claims that are not visible and verifiable on the page.
