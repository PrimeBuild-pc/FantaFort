# FantaFort keyword and intent map

Validated on 18 July 2026 with Brave Search across the US, Italy, Spain, Germany and France. The sample covers 70 localized queries and 700 top-10 organic results: the original seeds, clearer alternatives for ambiguous intents and the private-league cluster. Brave does not provide reliable search volume or keyword difficulty, so this document makes no claims about either.

FantaFort did not appear in the sampled top 10 results, and Brave returned no result for `site:fantafort.com`. This is an indexing baseline immediately after sitemap submission, not evidence that pages should be duplicated or expanded.

## Primary map

| Intent | English | Italian | Spanish | German | French | Target page | SERP decision |
|---|---|---|---|---|---|---|---|
| Product | Fortnite fantasy league | fantasy Fortnite FNCS | fantasy de Fortnite FNCS | Fortnite Fantasy-Spiel FNCS | fantasy Fortnite FNCS | locale homepage | Keep. Dedicated fantasy products appear, but the category is still sparse and mixed with unrelated Fortnite meanings. |
| Product education | how does a Fortnite fantasy league work | come funziona una fantasy league Fortnite | cómo funciona un fantasy de Fortnite FNCS | wie funktioniert ein Fortnite Fantasy-Spiel | comment fonctionne un fantasy Fortnite FNCS | locale `/how-it-works` | Keep, with FNCS and FantaFort context visible early. Broad translations otherwise resolve to general Fortnite guides. |
| Private leagues | private Fortnite fantasy league with friends | lega fantasy Fortnite privata con amici | liga fantasy privada Fortnite con amigos | private Fortnite Fantasy Liga mit Freunden | ligue fantasy Fortnite privée entre amis | locale homepage and `/how-it-works` | Supporting phrase only. Results favor private Fortnite matches or football fantasy; do not create a separate landing page. |
| Live data | FNCS tournaments and results | tornei e risultati FNCS | torneos y resultados FNCS | FNCS Turniere Ergebnisse | tournois résultats FNCS | `/tournaments` | Strong alignment. Current schedules, leaderboards and recap pages dominate in every market. |
| Player research | FNCS pro player stats | statistiche giocatori FNCS | estadísticas jugadores FNCS | FNCS Spieler Statistiken | statistiques joueurs FNCS | `/players` and qualified profiles | Keep, but use FNCS/competitive qualifiers. Generic “Fortnite stats” results mostly cover Battle Royale accounts or total player counts. |
| Scoring | Fortnite fantasy scoring system | sistema punteggio fantasy Fortnite | sistema de puntuación fantasy Fortnite | Fortnite Fantasy Punktesystem | système de points fantasy Fortnite | `/guides/fncs-scoring-guide` | Keep as a differentiated guide, not a high-confidence generic keyword. Official FNCS rules, ranked scoring and leaderboards dominate. |
| Team-level eliminations | how are eliminations counted in FNCS | come vengono contate le eliminazioni FNCS | cómo se cuentan las eliminaciones FNCS | wie werden Eliminierungen bei FNCS gezählt | comment sont comptées les éliminations FNCS | `/guides/team-eliminations` | Replace the generic “team eliminations” seed. Generic results overwhelmingly mean Creative/Verse; the FNCS long tail surfaces official rules. |
| Eligibility | how FantaFort selects players | come FantaFort seleziona i giocatori | cómo FantaFort selecciona jugadores | wie FantaFort Spieler auswählt | comment FantaFort sélectionne les joueurs | `/guides/player-eligibility` | Branded support intent. No established non-brand SERP exists; keep the page for trust and internal linking, not traffic projections. |

Only English and Italian guides are currently indexable. Spanish, German and French phrases validate locale intent for the homepage and “How it works”; they do not justify untranslated guide pages without Search Console demand and human review.

## SERP evidence

| Cluster | Dominant page types | Recurring competitors and sources | Common SERP features | Confidence |
|---|---|---|---|---|
| Fantasy product | product landing pages, community discussions, unrelated game/map results | `fantasyfortnite.app`, `nbfhub.com`, Reddit, Fortnite Esports Wiki | discussions, videos, infobox | Medium |
| Product education | product explainers where available; otherwise general Fortnite/FNCS guides | Reddit, `fantasyfortnite.app`, `nbfhub.com`, Epic/Fortnite, local gaming publishers | infobox, videos, occasional FAQ | Medium-low |
| FNCS tournaments | official schedules/rules, trackers, leaderboards, event recaps | `fortnite.com`, `fortnitetracker.com`, Wikipedia/Liquipedia, regional esports media | videos, discussions, infobox | High |
| Competitive players | trackers, records lists, rankings and player-count pages | `fortnitetracker.com`, `fortnite.gg`, Wikipedia, Reddit, regional publishers | discussions, videos, occasional FAQ | Medium |
| Scoring | official rules, ranked-system explainers, analytics and discussions | `fortnite.com`, Kinch Analytics, Reddit, Fortnite Wiki | videos, discussions, occasional FAQ | Medium-low |
| Eliminations | Epic Creative/Verse documentation for generic queries; official FNCS rules for qualified queries | `dev.epicgames.com`, `fortnite.com`, Fortnite Wiki | videos, discussions | High for the intent correction |
| Eligibility | unrelated football/fantasy selection advice | football fantasy publishers and help centers | videos, occasional FAQ | High that this is branded-only today |

Tournament and scoring results prominently reference current 2025–2026 seasons, so `/tournaments`, scoring rules and source timestamps must remain fresh. The SERPs also reward community discussions and video, but those formats should be pursued only with original, maintainable material rather than copied recaps.

## Locale findings

- **English:** clearest fantasy-product SERP and strongest mix of product competitors.
- **Italian:** product intent exists, but education, scoring and eligibility easily drift into general Fortnite or fantacalcio.
- **Spanish:** “liga fantasy” strongly collides with LaLiga Fantasy; use “fantasy de Fortnite FNCS”.
- **German:** “Liga” and generic “Fantasy” drift toward ranked Fortnite or football; use `Fantasy-Spiel` plus FNCS context.
- **French:** “ligue” drifts toward Fortnite competitive leagues and private matches; `fantasy Fortnite FNCS` is clearer.

## Cannibalization rules

- The homepage owns the broad product query; guides must not target the same primary phrase.
- `/how-it-works` explains the product and private-league feature; no separate private-league landing is justified yet.
- `/tournaments` owns current schedule/results intent; editorial recaps need a distinct event-specific intent before publication.
- `/players` owns generic competitive-player research; each qualified profile owns only that verified player entity.
- Scoring, eliminations and eligibility guides own their narrow explanatory intents.
- One canonical URL per locale and intent. Query-string filters are not indexable landing pages.

## Revalidation

Re-run the top-10 sample after 28 days of Search Console data, after a material product/scoring change, or when a new locale is considered for editorial publication. Compare dominant page type, query wording, FantaFort visibility and current competitors; change targets only when the evidence contradicts this map.
