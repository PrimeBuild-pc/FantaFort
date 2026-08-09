# FantaFort organic growth playbook

## Goal

Grow qualified organic discovery for the sandbox fantasy game, current FNCS data and verified player profiles. Rankings are an outcome, not a guarantee. Private pages, user data and low-value generated pages stay outside the index.

## Measurement setup

Setup confirmed on 18 July 2026:

- [x] Verify the `fantafort.com` domain property in Google Search Console through DNS.
- [x] Submit `https://fantafort.com/sitemap.xml` to Google Search Console.
- [x] Import the property into Bing Webmaster Tools with the sitemap.
- [x] Inspect `/`, `/it`, `/tournaments`, `/players/peterbot` and a guide in production with `npm run check:seo -- https://fantafort.com`.
- [ ] After 28 days of data, group Search Console queries into brand, fantasy-league, FNCS results, player profiles and scoring guides.
- [ ] Review indexing exclusions, Core Web Vitals and hreflang monthly.

Do not add behavioral analytics until its purpose, consent requirements and privacy-policy changes are approved.

### Baseline and targets

| Signal | First check | 90-day direction |
|---|---:|---:|
| Valid indexed public pages | after first crawl | all sitemap URLs eligible |
| Private URLs indexed | after first crawl | 0 |
| Non-brand impressions | weekly | sustained month-on-month growth |
| Organic registration visits | monthly | establish baseline, then improve |
| Mobile CWV | monthly | LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75 |
| Relevant referring domains | monthly | quality growth, no paid/spam links |

Do not set arbitrary traffic or ranking promises before Search Console has at least 28 days of data.

## Editorial cadence

The initial cluster consists of six evergreen guides in English and Italian. Review them after every scoring or provider change and at least quarterly. Add Spanish, German or French versions only when query data shows demand and a human review confirms content parity.

Potential data-led follow-ups:

- FNCS regional form report based on imported events;
- explanation of scoring differences with worked examples;
- tournament recap using official leaderboard totals;
- transparent release note when eligibility or pricing methodology changes.

Every publication must identify its source, sample window, update date and known limits. Do not publish mass-generated recaps that merely swap event or player names.

## Digital PR and authority

1. Turn original aggregated findings into a short chart, methodology note and embeddable source link.
2. Offer the finding to relevant Fortnite creators, esports analysts and community publications because it helps their audience, not in exchange for a link.
3. Ask Osirion whether they want to reference an implementation case study; preserve their attribution and terms.
4. Maintain consistent official brand profiles and link them with structured data only after they exist.
5. Participate in Reddit, Discord and creator communities as a product operator. Disclose affiliation and never manufacture mentions.
6. Do not buy links, create self-promotional Wikipedia pages, automate forum posts or publish unverifiable competitor claims.

## Release loop

- Before release: `npm run lint`, `npm run build`, `npm run check:seo`, `npm run check:api` and `npm run check:db`.
- After release: verify headers, sitemap, canonical and structured data on production.
- Week 1: inspect crawl/index coverage and production Lighthouse.
- Day 28: compare query clusters, CTR and indexed-page quality.
- Day 90: retain, consolidate or remove pages based on evidence; do not solve weak performance by multiplying thin pages.
