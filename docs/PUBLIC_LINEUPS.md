# Public leaderboard hygiene and opt-in lineup sharing

Status: implemented, default private. Security baseline: `docs/SECURITY_AUDIT_CLOSURE.md` is invariant.

## Administrators are excluded from the ranking

`global_leaderboard_rows()` now drops `profiles.is_admin = true` from the eligible CTE, **before**
`row_number()` runs. This is structural, not cosmetic: administrators are absent from the Top 50, are
not returned by nickname search, and every other rank is numbered as if they did not exist. No
nickname is hardcoded anywhere; the owner account disappears purely as a consequence of the flag.

All previous eligibility rules are unchanged: `account_status = 'active'`, no `auth.users.deleted_at`,
not banned, no `test_marker`.

## Lineup source: what "formazione" means here

The model was inspected before choosing a source. FantaFort has **no separate selected lineup at
account level**:

| Concept | Table | Status |
|---|---|---|
| Account holdings | `account_positions` | Current. One row per owned player, no slots, no roles, no bench, no reserve. Bought/sold via `account_buy_player` / `account_sell_player`, limited only by coins and a daily trade cap. |
| Per-league roster | `league_roster_entries` + `leagues.slots` | Current, but league-private. This is the only slot-based roster (the "3-player roster"), it runs on an isolated league economy and is deliberately excluded from global net worth. |
| Legacy roster | `roster_entries` | Dead. Superseded by `account_positions` in `202607170003_account_economy.sql`, which migrated the active rows across. Nothing writes it. |

The account-level portfolio is therefore the canonical global lineup — and it is exactly what
`global_leaderboard_rows()` values to produce the published rank, so the shared lineup is the
composition that explains the position. Private-league rosters are **not** exposed by this feature.

If a distinct account-level lineup (slots, roles, starters vs reserves) is introduced later,
`get_public_lineup` is the single place to repoint; no client would change.

## Privacy model

`profiles.public_lineup_enabled boolean not null default false` — private for every existing account
and every new signup. It is deliberately independent of the email/community consent, of Discord, and
of Terms acceptance; it has its own control, its own RPC and its own copy.

Writes go through `set_public_lineup_visibility(enabled)`. `profiles` has no update policy, so direct
client writes are rejected by RLS. The RPC takes no target parameter, so a caller can only ever flip
their own row.

Reads go through `get_public_lineup(target_username)`:

| Caller / target | Result |
|---|---|
| Anonymous | `Sign in required` |
| Suspended or inactive viewer | `Sign in required` |
| Target private, unknown, administrator, banned, deleted, anonymized or synthetic | `Lineup not available` — one identical error, so holdings cannot be enumerated by comparing failures |
| Target opted in, no players | success with an empty `lineup` array — a clean empty state, not an error |
| Target opted in with players | minimal payload |

The owner always sees their own portfolio through the existing screens, regardless of the toggle.

### Data minimization

Returned: `username`, `nameStyle`, `rank`, `netWorth`, public `badges`, and per player `playerId`,
`handle`, `realName`, `team`, `photoUrl`, `rarity`, `currentPrice`. Rank, net worth and badges are
already public on the leaderboard, and every player field is already public through
`get_market_players()` (granted to `anon`). The only new information is *which* players a consenting
account owns.

Never returned: email, user UUID, wallet balance, locked balance, transaction history, acquisition
price, realized/unrealized P&L, daily P&L, watchlist, strategy metadata, audit or auth metadata.
No broad `SELECT` is opened on `account_positions`, `account_wallets` or `profiles`; the RPC is
`SECURITY DEFINER` with a fixed `search_path`, revoked from `PUBLIC`/`anon` and granted only to
`authenticated` and `service_role`.

The leaderboard row exposes a single extra boolean, `public_lineup`, so the UI can offer the lineup
where it exists and label the rest "private". That boolean is the account's own public choice.

### Immediate revocation

Visibility is read live inside the RPC on every call: switching the toggle off makes the next read
fail. There is no server cache and no long-lived client cache — the drawer fetches on open and drops
the payload on close, so no lineup can outlive a visibility change.

## Threat model

| Threat | Control |
|---|---|
| Administrator inflating or polluting the public ranking | Excluded from the eligible set before ranking; not searchable; not exposable as a lineup |
| Scraping private holdings | Reader requires an authenticated, active session and an explicit opt-in |
| Enumerating who owns what by probing errors | Unknown, private, ineligible and administrator targets return one identical error |
| Enumerating by UUID | The reader takes a nickname; no user UUID is accepted or returned |
| Changing someone else's visibility | RPC has no target parameter; `profiles` has no update policy |
| Stale exposure after opting out | Visibility re-read per request; no caching layer |
| Broad data leak through a new surface | Payload restricted to fields already public elsewhere, asserted field-by-field in `check:community` |
| N+1 or unbounded query | One set-based RPC returns rank, badges and the whole lineup; nickname lookup is indexed on `lower(username)` |

## Verification

`check:community` covers: administrator excluded before ranking, a richer-than-everyone administrator
leaving rank #1 untouched, administrator not searchable, contiguous renumbering, default visibility
false, anonymous denied, authenticated-but-private denied, authenticated-and-public success,
case-insensitive nickname, exact payload field sets, no email/UUID/wallet/P&L/acquisition data,
owner-only preference, direct write rejected, ineligible targets indistinguishable from unknown ones,
empty lineup state, and immediate denial after opting out.

## Rollback

The migration is additive: one column defaulting to `false`, one index, two new functions and two
replaced function bodies. Rolling back is a reviewed follow-up migration that restores the previous
`global_leaderboard_rows()` and `get_global_leaderboard()` bodies and drops the new functions and
column; no user data is involved. Disabling the feature operationally needs no deploy — with every
account defaulted to private, the reader simply returns "not available".
