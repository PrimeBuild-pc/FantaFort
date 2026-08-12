# Pro-player expansion plan — feasibility assessment

Status: **all six phases implemented.** Ongoing rules now live in `docs/PRO_PLAYER_POOL.md`; this
file is kept as the record of how the decisions were reached and what was measured.

Target agreed with the operator: **~8,000 tracked pro players**, weighted to **NAC/NAW (US)**,
**West-EU**, and **Italy**, including **streamers who meet a pro requirement** (e.g. Piz in Italy).

**Mobile is deferred to its own branch** by operator decision. It is excluded explicitly in
`src/lib/pro-eligibility.ts` and guarded by `npm run check:pool`, so it cannot slip in half-done —
importing mobile players without also scoring their events would create cards that never earn a
point. The mobile capacity measured in §1 is retained here as input for that future branch.

**Verdict: feasible, with two blockers that must be cleared first (§2).** The provider has far more
data than we need — the hard part is *selection and delivery*, not supply.

Invariants: `docs/SECURITY_AUDIT_CLOSURE.md`, RPC-only writes, RLS, bounded/validated provider
fetches, no fabricated player metadata, no new dependency that existing code can cover.

---

## 0. Verified current state

### Pool import — `scripts/sync-player-pool.mjs`

| Aspect | Current value |
|---|---|
| Regions | `EU`, `NAC`, `NAW`, `OCE` (line 23). `BR`, `ASIA`, `ME` exist in `src/lib/osirion.ts:5` but are never imported |
| Events | FNCS only (`/fncs/i`, line 27), excluding Division 4/5 |
| Lookback | 120 days (line 30) |
| Windows scanned | incremental: EU 3, others 1. full: EU 36, others 12 (line 38) |
| Leaderboard depth | **page 0 only** (line 45), `rank <= 100` (line 51) |
| Div 2/3 rule | rank ≤ 10 only, unless EU + Italian flag (line 53) |
| Deactivation | every `active` player **without `photo_url`** absent from the current import (line 75) |

### Results sync — `scripts/sync-fortnite.mjs`

- `isFantasyEvent` (line 24-29) admits `fncs|victorycup|cashcup` + Division 1 divisional cups, and
  **rejects `mobile|console|ranked|playstation|zerobuild|trioszb|soloszb`**.
- Regions `EU`, `NAC` only; 8 windows/region, 2 pages each.
- Writes `tournament_team_members` for **every** account seen, `player_id` NULL when not in the pool.

### Market read path

`get_market_players()` (`202607170001_strategy_game.sql:423`) returns **all** active players with four
lateral joins including a `teammates` JSON blob. `getAllMarketPlayers()` (`src/lib/market-players.ts`)
pulls the entire market into the browser at login (`src/context/GameContext.tsx:79`); search is a
client-side filter (`src/app/dashboard/page.tsx:38`).

### Scheduling

`.github/workflows/sync-fortnite.yml` runs every 15 minutes: pool import in **incremental** mode,
then the results sync.

---

## 1. Measured provider capacity (read-only probe, 2026-08-11)

Sampled live against `https://fnapi.osirion.gg/v1`, no credentials, no writes.

**Events available per region, last 120 days:**

| Region | Recent windows | fncs | MOBILE | cashcup | victorycup | ranked | console |
|---|---|---|---|---|---|---|---|
| EU | 356 | 111 | **57** | 6 | 14 | 61 | 29 |
| NAC | 355 | 111 | **57** | 6 | 12 | 60 | 29 |
| NAW | 289 | 77 | **57** | 6 | 12 | 60 | 29 |
| BR | 289 | 77 | **57** | 6 | 12 | 60 | 29 |
| OCE / ASIA / ME | ~290 | 77 | ~56 | 6 | 12-14 | 60 | 29 |

**Leaderboard depth (EU samples):**

| Event | Entries/page | Total pages | Accounts, page 0 | Accounts, full window |
|---|---|---|---|---|
| `FNCSDivisionalCup_Division1_EU` | 50 | 1 | 100 | **100** |
| `FNCSDivisionalCup_Division2_EU` | 100 | 13 | 200 | **~2,600** |
| `MobileSeriesOpen_EU` | 100 | **38** | 100 | **~3,800** |
| `CashCup_DuosZB_EU` | 42 | 1 | 84 | **84** |

**Consequences.** A *single* Div2 EU window yields ~2,600 accounts and a *single* Mobile Series
window ~3,800. Across 7 regions and hundreds of windows, raw supply is in the hundreds of thousands.
**8,000 is a budget to spend deliberately, not a target to reach.** Depth is also quality decay:
Mobile Series page 38 is rank ~3,800 and is not a pro by any definition.

**Flag tokens** are `GroupIdentity_GeoIdentity_<country>`, present on 389/400 sampled accounts.
In a Div2 EU window, Italians were 20/400 (~5%). Two caveats: the flag is **player-selected**, so it
is a soft nationality signal, not authoritative; and the UK is fragmented across `unitedkingdom`,
`england`, `scotland`, `wales`. "West-EU" therefore needs an explicit country allowlist, not a guess.
The existing rule uses `/italy/i` against this token (`sync-player-pool.mjs:53`) and is correct.

---

## 2. Blockers — must clear before any expansion

**B1 — The client downloads the whole market.** Every login pulls all active players with per-player
`teammates` JSON. At ~1,693 players this is already heavy; at 8,000 it is several MB per login and
the client-side search filter degrades with it. **Expanding before phase 3 would ship a visibly
broken product.** This is the single thing that makes the request "not feasible as-is" — and phase 3
makes it feasible.

**B2 — Mobile pros are excluded twice over, and one path is silently broken.** Mobile events are
named `MobileSeriesOpen`, `BakMobileCup`, `MandalorianMobileCup` — they contain no `fncs`, so the
pool import's `/fncs/i` filter never imports them. The results sync separately rejects `/mobile/`.
So today: mobile pros cannot enter the pool, **and if one ever did, they would score zero forever**
because the results sync would never read their events. Supporting mobile means changing both
filters together; changing only the import creates dead cards.

**B3 — the pool churns every 15 minutes. CONFIRMED, and fixed in phase 1.** Measured read-only on
2026-08-11:

| | Production | Staging |
|---|---|---|
| Total players | 5,264 | 2,702 |
| **Active** | **1,036** | 2,702 |
| Inactive | **4,228** | 0 |
| Inactive *without* a photo | **4,228 (100%)** | 0 |

Every single deactivated row is photo-less — exact correlation with the `!player.photo_url`
condition in the deactivation predicate. The 1,036 survivors match the last incremental run's
windows precisely (802 "Global Championship Last Chance" across NAC/OCE/EU/NAW + 173 "Champion
Aphrodite FNCS Cup · EU" + 59 + 2). Division 2/3 — the regional and Italian cohort — has been wiped:
**one** Division 1 player remained active. Staging shows the uncorrupted shape (Div 1/2/3 balanced)
only because the sync has never run there: `player_results` and `tournament_team_members` are both 0.

`tournament_team_members` holds **27,747** rows in production, so the phase-5 search index is
already healthy.

**B4 (measure) — `refresh_market_prices()` scales per player.** It is a plpgsql loop over every
active player, each with a correlated `order by ends_at desc limit 5` subquery, and it runs every 15
minutes (`202607170001_strategy_game.sql:383`). At 8,000 players this may become the bottleneck.
Measure before and after phase 4; rewrite set-based only if measurement demands it.

---

## 3. Required order

```
Phase 1  stabilise the pool          (B3)
Phase 2  one definition of "pro"     (incl. mobile + streamers)
Phase 3  server-side market          (B1 — the feasibility unlock)
Phase 4  expand breadth to ~8k       (the actual expansion, incl. B2)
Phase 5  missing-player search       (dynamic load + caching)
Phase 6  docs + checks
```

Recommended PRs: **A = 1-2**, **B = 3**, **C = 4-6**. Phase 3 is the risky one; it should not share
a PR with anything else.

---

## Phase 1 — Stabilise the pool

Measure first (read-only, staging then production, Supabase dashboard SQL editor — no local CLI
credentials, per the backup incident):

```sql
select count(*) filter (where active) active_players,
       count(*) filter (where active and photo_url is null) exposed_to_deactivation,
       count(*) total
from public.players;
```

Then:

1. **Never deactivate in incremental mode** — gate `sync-player-pool.mjs:75-79` on `fullSync`.
2. **Decay instead of presence.** Add `players.last_seen_at`; stamp it for every account seen;
   deactivate only when older than a grace period (start 180 days) *and* in a full sync. Drop the
   `photo_url` proxy — it means "marquee player", not "still active".
3. **Split the jobs.** 15-minute workflow keeps results only. Pool import moves to its own daily
   `--full` workflow. Removes the churn and frees the request budget phase 4 needs.

Files: `scripts/sync-player-pool.mjs`, new migration `<ts>_player_last_seen.sql`,
`.github/workflows/sync-fortnite.yml`, new `.github/workflows/sync-player-pool.yml`, `package.json`.

Verify: staging `--dry-run`, then a real full sync; confirm the active count is stable across two
consecutive result syncs.

---

## Phase 2 — One definition of "pro"

New `src/lib/pro-eligibility.ts`, consumed by **both** scripts; delete the duplicated filters. It
must answer one question: *given an account, an event and a placement, is this a pro, and why?*

**Proposed tiers and 8,000-slot allocation** (confirm in §7):

| Tier | Rule | Slots |
|---|---|---|
| `elite` | FNCS Div 1 / Global finals, any imported region | ~400 |
| `contender` | FNCS Div 2 top ~600, Div 3 top ~100, imported regions | ~2,500 |
| `mobile` | Mobile Series / mobile cups, top ~400 per region (EU, NAC, NAW) | ~1,500 |
| `regional` | West-EU + Italy country allowlist, deeper rank threshold (top ~1,500 EU) | ~2,500 |
| `open` | Cash Cup / Victory Cup high placements not already covered | ~1,000 |
| `curated` | Recognised figures who compete but miss every threshold — see below | ≤ 100 |

**Mobile is a first-class tier, not an exception.** Both the import filter and
`isFantasyEvent` in the results sync must admit the same mobile events (B2). Open question for §7:
mobile and PC results are *not* comparable — decide whether mobile players share the PC price band
and scoring, or get their own band. Do not ship 8k with this undecided.

**Streamers / recognised figures (the Piz case).** A rank threshold cannot capture someone who is a
pro by standing rather than placement. Rule: a small, explicit, version-controlled allowlist of
**account ids**, each requiring (a) at least one real competitive appearance in our stored results,
and (b) a written justification in the file. This keeps every displayed statistic real — it is a
*membership* decision, never invented metadata — and it stays auditable and small. No name-matching,
no scraping.

Migration: `players.pro_tier` + check constraint, `last_seen_at` (phase 1), reuse `eligibility_note`
as the human-readable reason. An account we cannot classify does not enter the pool.

Pricing stays untouched in this phase — changing membership and pricing together makes regressions
unattributable.

Verify: `npm run sync:players -- --dry-run` before/after. At this point the set should be identical
except for tier labels; any membership change here is a bug.

---

## Phase 3 — Server-side market (the feasibility unlock)

It also fixes the admin console's load times: `Header` calls `useGame()` and sits on every admin
page, so today every admin screen waits for the entire market to download before it renders.

### Consumer map of `GameContext.players` (written before editing, per the rule below)

| Consumer | Uses | Needs after the change |
|---|---|---|
| `src/context/GameContext.tsx:137` | `setTeam(market.filter(id in rosterIds))` — **the roster is derived from the full market** | `get_players_by_ids(rosterIds)` |
| `src/app/dashboard/page.tsx:13` | market grid, client-side `query` filter, pagination | `search_market_players()` |
| `src/app/trading/page.tsx:18` | search + buy/sell | `search_market_players()` |
| `src/app/leagues/[id]/page.tsx:24` | resolves player names for standings/rosters | `get_players_by_ids()` |
| `src/components/PlayerCard.tsx`, `src/app/dashboard/team/page.tsx` | `team` only, never `players` | unaffected once `team` is populated |

`GameContext.tsx:137` is the load-bearing line: nothing else forces the whole market to exist
client-side.

1. `search_market_players(query, tier, cursor, limit)` returning a **light** row — id, handle,
   organization, photo_url, rarity, price, price_change. No `teammates`, no career laterals. Bounded
   `limit` (≤ 50), validated inputs, `security invoker`, grants as `202607170001_strategy_game.sql:478`.
2. `get_players_by_ids(ids text[])` (bounded) so rosters resolve without loading the market.
3. `get_market_player(id)` keeps the rich payload for the detail card only.
4. Indexes: `players(lower(handle) text_pattern_ops)` for prefix search, `players(active, price desc)`
   for default ordering. Add `pg_trgm` only if substring search is explicitly wanted.
5. Client: `GameContext` loads roster + portfolio, not the market. Dashboard search becomes a
   debounced server query, preserving the existing accessible input.

Verify: `npm run build`, `lint`, `check:db`, `check:community`; login payload before/after; staging
smoke test of buy/sell, lineup, standings.

---

## Phase 4 — Expand to ~8,000 — DONE

**Measured result (real dry run, 2026-08-12): 7,063 players** from 48 windows across 3 regions,
using 119 of a 400-request budget. Tiers: elite 300 · contender 5,173 · regional 804 · open 786.
Up from 1,036 active.

**A blocker had to be cleared first: recruitment and scoring disagreed, in both directions.**

| Event | Entered the pool | Could score |
|---|---|---|
| FNCS Divisional Cup Division 1 | yes | yes |
| FNCS Divisional Cup **Division 2** | **yes** | **no** |
| FNCS Divisional Cup **Division 3** | **yes** | **no** |
| Cash Cup | **no** | yes |

Division 2/3 is precisely the contender and Italian cohort this expansion targets, so expanding
before fixing that would have shipped roughly 5,000 cards that could never earn a point. The same
asymmetry existed by region: intake covered EU/NAC/NAW/OCE while scoring covered EU/NAC only, so
**every NAW and OCE player was already a dead card before this work started**.

Both are now structural rather than documented: one `isCompetitiveEvent` predicate serves
recruitment and scoring, `POOL_REGIONS` is imported by both crawlers, and `MAX_QUALIFYING_RANK`
caps recruitment at the depth the results sync actually re-crawls. `check:pool` fails if a crawler
hard-codes a region or if an event can recruit without being scoreable.

Regions settled at **EU, NAC, NAW**. OCE and BR were dropped rather than carried: each region also
costs results-sync budget every cycle, and neither is in the target audience.

Levers applied:

1. **Depth** — pagination to rank 300, page count derived from the observed page size (solo pages
   hold ~100 entries, duo/trio far fewer) and capped at 8 pages.
2. **West-EU + Italy allowlist** (approved): `italy`, `france`, `germany`, `spain`, `portugal`,
   `netherlands`, `belgium`, `switzerland`, `austria`, `ireland`, plus all four UK tokens. Matched
   against `GroupIdentity_GeoIdentity_<country>`; treated as a soft, player-declared signal. The
   home cohort qualifies at ranks where nobody else does, but never past `MAX_QUALIFYING_RANK`.
3. **Event types** — Cash Cups and Victory Cups now recruit as well as score.
4. **Lookback** — 180 days, safe now that decay governs removal.
5. **Tiers** — `players.pro_tier`, used to keep the strongest claims when the crawl exceeds target.

Known and accepted: a player recruited from a window older than the results sync's 14-day horizon
shows no statistics until they next compete. Their card reports that honestly rather than
fabricating history, and `refresh_market_prices` leaves their seeded price alone until results exist.

Mobile remains out — separate branch.

### Original plan



Enable one lever at a time, measuring pool size, tier distribution and request count after each:

1. **Depth** — paginate past page 0, bounded by `totalPages` and a per-tier page cap.
2. **West-EU + Italy country allowlist** (approved): `italy`, `france`, `germany`, `spain`,
   `portugal`, `netherlands`, `belgium`, `switzerland`, `austria`, `ireland`, plus all four UK
   tokens (`unitedkingdom`, `england`, `scotland`, `wales`). Matched against
   `GroupIdentity_GeoIdentity_<country>`; treat it as a soft, player-declared signal.
3. **Regions** — add `BR`; keep `ASIA`/`ME` out unless asked (target audience is US/West-EU/Italy).
4. **Event types** — Cash Cups / Victory Cups at the `open` tier.
5. **Lookback** — extend past 120 days now that decay governs removal.

Mobile is *not* a lever here — separate branch.

**Request budget.** A targeted full sync reaching ~8k costs roughly 200-400 leaderboard requests
(Div1 4 + Div2 6 + Div3 4 + Mobile 15 + cups ~20, multiplied over several historical windows).
At the provider's ~60 requests/minute that is 4-7 minutes — comfortably inside a daily job with a
15-minute timeout. The 15-minute results job keeps its own separate budget.

Also measure `refresh_market_prices()` runtime at 8k (B4).

---

## Phase 5 — Missing players: dynamic load + caching

`tournament_team_members` already stores `account_id`, `username`, `flag_token` for every account on
every crawled leaderboard, with `player_id` NULL when not in the pool. That is the search index —
no new provider dependency required.

1. `search_known_accounts(query, limit)` over that table where `player_id is null`, grouped by
   account, returning username, flag and the events proving the account exists. Bounded, validated,
   prefix match.
2. UI: when a market search misses, offer these as "not in the pool yet", with their real events.
   Never invent stats.
3. **Promotion** — `SECURITY DEFINER`, strictly gated (this writes the table feeding pricing and
   scoring): validates the account against phase-2 tier rules from *stored results*, never user
   input; rejects non-qualifying accounts; per-user rate limit; audit row. Admin-only first (§7).
4. **Caching** — `unstable_cache` (already used in `src/lib/public-players.ts`, `osirion.ts`) for
   query → results, **including negative results**. A cache table only if measurement shows heat.

**Optional spike, timeboxed:** whether Osirion exposes a player lookup by username/account id, its
credit cost, and whether the API terms permit request-time use. Public docs describe a credit model
and no confirmed search endpoint. If unfavourable, record the negative result in `CLAUDE.md` beside
the Fortnite-API.com finding so nobody re-investigates.

---

## Phase 6 — Docs and checks

- Doc for the pro definition, tiers, decay, curated allowlist and promotion path.
- Update `CLAUDE.md`: pool size, regions, mobile inclusion, job split, cadence.
- Extend `check-fortnite.mjs` / `check-api-bounds.mjs` for the new RPC bounds; add search to `check:db`.
- A runnable check that fails if the import would deactivate in incremental mode (the B3 regression).

---

## 7. Decisions needed before execution

| # | Question | Recommendation |
|---|---|---|
| 1 | Confirm the tier allocation in §2 (400/2500/1500/2500/1000/100) | Adopt as the starting split, retune after the first full sync |
| 2 | **West-EU country allowlist** — exact list, given UK is split into `unitedkingdom`/`england`/`scotland`/`wales` | IT, FR, DE, ES, PT, NL, BE, CH, AT, IE + all four UK tokens |
| 3 | **Do mobile players share the PC price band and scoring?** | Separate price band, same market. Mobile lobbies are not comparable to PC; one shared band mis-prices both |
| 4 | Who maintains the `curated` allowlist, and what justifies entry? | Operator-only, file-based, ≤100 entries, each with a written reason + one real competitive appearance |
| 5 | Include ZeroBuild events? (currently excluded from results, not from the import) | No for now — keeps scoring comparable; revisit if the audience asks |
| 6 | Promotion: admin-only or any authenticated user? | Admin-only first, open up after the rate limit and audit have run in staging |
| 7 | Should pricing change with tiers? | Not in this work — membership first, pricing separately |

## 7b. Deferred decisions (agreed 2026-08-12)

**Unconfirmed email must block the Founding 50 award.** Agreed: the account keeps its historical
slot but is not awardable until it confirms, exactly as suspension already behaves. Implementation
is one extra condition plus an `award_block_reason` value in `admin_preview_founding_50()` and the
matching guard in `admin_set_user_badge`. Affects 3 of 31 candidates today.

**Not adopted as specified — the expiry/re-dating machinery.** The operator also asked that an
account which fails to confirm within a week lose its historical slot, be set to `suspended`, and be
re-dated to its confirmation time, with an activity-based exemption. Three problems, recorded rather
than built:

1. `account_status = 'suspended'` is not a neutral lifecycle state. It is the **precondition for
   anonymization** (`202607190008_admin_anonymization.sql:54` refuses to anonymize anything else),
   it is what a self-service **deletion request** sets (`202607250001_privacy_requests.sql:47`), and
   it drives the `suspendedUsers` metric. Auto-suspending unconfirmed signups would make them
   anonymisation-eligible and indistinguishable from users who asked to be deleted.
2. Re-dating breaks the property the ordering depends on. The slot order comes from
   `auth.users.created_at` precisely because Auth owns it and it is immutable; the docs state a
   historical slot "does not change when the account's status changes". A mutable order needs a
   separate `profiles.founding_order_at` column and an explicit decision to make history editable.
3. The activity-based exemption ("if they trade, just remind them") reintroduces unstable heuristics
   into eligibility, which `ADMIN_BADGE_CAPABILITY.md` deliberately excludes in favour of stable
   database facts.

**And it currently solves nothing:** there are 31 candidates for 50 slots, so no unconfirmed account
is blocking anyone. Revisit only if real signups exceed 50. A confirmation-reminder email is a
separate feature — no notification system exists yet, and sending mail to real users needs explicit
per-send approval.

## 8. Out of scope

Pricing-model redesign, scoring formula changes, player photos/licensing, news-sentiment pricing,
Founding 50 / badges.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Phase 3 breaks a market consumer not on the list | Write the consumer list before editing; staging smoke test |
| Mobile imported without results support | B2: both filters change in the same commit, with a check |
| Expansion hits the provider rate limit | Budget computed per lever; pool job separated from the results job |
| `refresh_market_prices()` degrades at 8k | Measure per phase; set-based rewrite only if needed |
| Curated allowlist grows into unmaintained curation | Hard cap, written justification, reviewed in PR |
| User-driven promotion pollutes the pool | Tier validation from stored results, rate limit, audit, admin-only first |
