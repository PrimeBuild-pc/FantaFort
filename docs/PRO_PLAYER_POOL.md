# Pro player pool

How a Fortnite account becomes a card in the market, how it stays one, and how it leaves.
Rules live in `src/lib/pro-eligibility.ts`; `npm run check:pool` fails if the code drifts from them.

## The invariant

**Anything that can recruit a player must also be able to pay them.**

This has been broken twice. FNCS Divisional Cups at Division 2/3 entered the pool but were rejected
by the scoring filter, so those players could never earn a point; and intake covered EU/NAC/NAW/OCE
while scoring covered EU/NAC, so NAW and OCE players were unscoreable from the day they arrived.

It is now enforced structurally rather than by comment:

| Mechanism | What it prevents |
|---|---|
| One `isCompetitiveEvent` predicate for intake and scoring | An event that recruits but does not pay |
| `POOL_REGIONS` imported by both crawlers | A region only one of them covers |
| `MAX_QUALIFYING_RANK` (300) shared by both | Recruiting deeper than scoring re-crawls |
| `check:pool` source guards | A crawler hard-coding its own region list |

## Tiers

Assigned from the strongest qualifying claim across all scanned events, stored in `players.pro_tier`
with the human-readable reason in `eligibility_note`.

| Tier | Rule |
|---|---|
| `elite` | FNCS Division 1 or a main event (global/grand final), top 200 |
| `contender` | FNCS Division 2 top 300, Division 3 top 100, other FNCS top 300 |
| `regional` | Home-audience flag, any competitive event, top 300 |
| `open` | Cash Cup or Victory Cup, top 200 |

Divisions 4-5, ranked, console, ZeroBuild and mobile are excluded. Mobile is deferred to its own
branch: mobile lobbies are not comparable to PC, so sharing the price band and scoring would misprice
both — and admitting it requires changing intake and scoring together or it creates dead cards.

## Home audience

Matched against Epic's `GroupIdentity_GeoIdentity_<country>` token: Italy, France, Germany, Spain,
Portugal, Netherlands, Belgium, Switzerland, Austria, Ireland, and all four UK tokens
(`unitedkingdom`, `england`, `scotland`, `wales` are separate values).

The flag is **player-selected**, so it is a soft signal and never treated as authoritative
nationality. It only ever widens eligibility — the home cohort qualifies at ranks where nobody else
does — and never restricts it.

## Membership decay

Membership decays on time, not on absence from one crawl. A player leaves after
`POOL_GRACE_DAYS` (180) without appearing, and **only a full sync may deactivate**.

This is the fix for a live incident: the import ran incrementally every 15 minutes over ~6 windows
and deactivated everyone missing from that run, leaving 1,036 active players of 5,264, with Division
2/3 wiped down to a single active player. `check:pool` fails if an incremental run can deactivate,
or if `photo_url` is used as an activity proxy again.

## Crawl budget

The pool import runs daily in full mode; the results sync runs on its own schedule and keeps a
separate budget. Both derive page counts from the observed page size, since solo pages hold ~100
entries and duo/trio far fewer. A measured full crawl costs ~119 requests of a 400 budget and
produces ~7,000 players.

## Players not in the market

`tournament_team_members` records every account seen on a synced leaderboard, with `player_id` NULL
when it is not carried. `search_known_accounts` surfaces those on a market search miss, showing only
what is already recorded — best rank, appearances, latest event. Nothing is estimated.

`admin_promote_known_account` adds one to the market. Eligibility comes from stored results, never
from the caller: an account qualifies only if it has a result within `MAX_QUALIFYING_RANK`, and
presence in `tournaments` is itself proof the event passed the competitive filter at sync time — so
the rules are not restated in SQL and cannot drift from the module.

Promotion is administrator-only, AAL2, rate limited and written to the append-only audit log. It
does **not** use a step-up grant: step-up re-authenticates irreversible actions against user data,
while this adds a game asset that is undone by setting the row inactive.

Because it skips step-up, it cannot inherit the runtime gate the step-up trigger applies to the
other admin mutations, so it carries its own fail-closed switch:
`admin_runtime_config.player_pool_mutations_enabled`, default false, service role only. It is
separate from the general admin switch for the same reason the badge capability is: promoting a
player must not require unlocking wallet, role and status mutations.

Enable it exactly like the badge capability — **both** switches are required, either alone leaves
promotion disabled:

1. Database (service role only, from the Supabase SQL editor):
   ```sql
   update public.admin_runtime_config set player_pool_mutations_enabled = true, updated_at = now() where singleton;
   ```
2. Vercel: add `ADMIN_PLAYER_POOL_MUTATIONS_ENABLED=true` (Production, sensitive, **never**
   `NEXT_PUBLIC_`) and redeploy.
3. Verify at `/admin/players`: the read-only notice disappears when both are on.

Promote from `/admin/players`: search a name, pick a tier, give a reason. Disable by reverting
either switch; existing promotions are undone by setting the player inactive.

The search itself excludes accounts already carried by **account id**, not by the member row's
`player_id`: that column is stamped at sync time, so rows recorded before an account was imported
keep NULL forever and would otherwise offer a player the market already has.

## Results come from the same crawl

The pool import writes the leaderboards it downloads. A recruited player therefore arrives with the
result that qualified them, at no extra provider request, instead of a blank card: before this, 94%
of the `regional` and `open` tiers - the home cohort this product is for - had no statistics at all,
because the results sync only re-crawls the last 14 days while intake looks back 180.

## Leaving the pool

Two ways out, both only on a full sync:

- **Decay** - `POOL_GRACE_DAYS` (180) without appearing in an import.
- **Legacy sweep** - entries written by the importer before tiers existed, identified by its own
  `Top 100 · ` note prefix. They were chosen by rules we no longer stand behind, including regions
  that are no longer synced and whose players can never score again, so waiting out the grace period
  would keep them sellable for months. Curated and seeded entries never carried that prefix and are
  untouched; guessing from `photo_url` instead is what emptied the pool the first time.

## Known limits

- A player whose qualifying window is not re-crawled keeps the result stored at import time but does
  not accumulate new statistics until they next compete inside the results sync's 14-day horizon.
  The card reports what exists rather than fabricating history.
- Fortnite leaderboard eliminations are team-level; fantasy scoring assigns official team points to
  each rostered player.
