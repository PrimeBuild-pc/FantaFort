# Community, leaderboard and badges plan

Status: implementation plan. Base branch: `main`. Security baseline: `docs/SECURITY_AUDIT_CLOSURE.md` is invariant.

## Current architecture inventory

- Identity: Supabase Auth users map 1:1 to `public.profiles` through `handle_new_user()`. Public-facing identity is `profiles.username`; email and auth metadata remain in `auth.users`.
- Account economy: liquid game coins are `account_wallets.balance`; league stakes reserve coins in `account_wallets.locked_balance`. Account player assets are `account_positions`, valued at the current `players.price`. `get_account_portfolio()` already applies the same valuation to the signed-in account.
- Private leagues: `league_members.coins` and `league_roster_entries` belong to isolated league economies and are not part of global account wealth.
- Market: current prices are stored in `players.price`; historical movements are in `player_price_history`.
- Admin: read RPCs require `authorize_admin_request()` and AAL2. Mutations require same-origin server routes, short-lived scope/target/session-bound MFA grants, server and database kill switches, idempotency and append-only `admin_audit_log`. `ADMIN_MUTATIONS_ENABLED` and `admin_runtime_config.mutations_enabled` remain false.
- Notifications: private in-app notices use `notifications` and `get_notifications()`; there is no bulk email campaign system. Supabase Auth SMTP is transactional infrastructure, not a campaign sender.

## Product design

### Community and communication consent

The official community URL is <https://discord.gg/V3m8pDe3wz>. It will be exposed as a safe external link in public and authenticated footers, the marketing home, account settings and a dismissible in-app beta notice. No iframe, widget, Discord OAuth or role synchronization is introduced.

`profiles.community_email_opt_in` defaults to `false`. Opt-in, opt-out, consent version and consent source are recorded atomically through an owner-only RPC; the checkbox is never preselected and consent is independent of Terms/Privacy. No email is sent in this release.

A future campaign system must be a separate reviewed change with an appropriate provider and tables for immutable campaign snapshots, preview/test sends, bounded batches, per-recipient outcomes, retries, unsubscribe handling and audit. Only currently opted-in recipients may be selected. Tracking pixels remain off by default. Supabase Auth SMTP must not be reused for bulk campaigns.

### Global net worth and ranking

Global net worth is:

```text
account_wallets.balance
+ account_wallets.locked_balance
+ SUM(players.price for each current account_positions row)
```

Locked account coins remain owned by the account and are therefore included. Private-league budgets and rosters are excluded.

A minimal `SECURITY DEFINER` RPC returns only rank, username, cosmetic name style, net worth, public badges and whether the row belongs to the caller. It computes the ranking once with set-based joins: no client-side valuation, wallet exposure or N+1 queries. Top 50 is returned by default; an authenticated caller outside the Top 50 also receives their row. Nickname search ranks against the same full eligible population and returns bounded matches.

Ranking is a deterministic ordinal (`row_number`): net worth descending, then profile creation time ascending, then internal UUID ascending as a non-returned final tie-break. Thus every displayed position is unique and stable for an unchanged dataset.

Only active, non-anonymized accounts without a synthetic test marker are eligible. Suspended accounts, long-banned accounts, deleted/anonymized profiles and accounts marked by security/integration tests are excluded. Email, UUID, Auth data, wallet history and holdings are never returned.

A live set-based query is preferred over a materialized view in v1: current free-plan scale is thousands to tens of thousands of accounts, account positions are bounded and indexed by user, and live calculation avoids refresh invalidation across wallets, positions and prices. Revisit a short server cache/materialized snapshot only after query-plan evidence shows a need.

### Badges

`badges` stores public definitions and assignment type (`manual`, `automatic`, `dynamic`). `user_badges` stores durable awards with award time, source, optional admin actor and reason. Badges are public metadata only and never participate in authorization.

Initial definitions:

- `founding-50`: automatic one-time award, but not assigned by migration. An AAL2 admin preview identifies the first 50 real accounts by trusted Auth registration time, then UUID, after the same eligibility exclusions.
- `beta-tester`: automatic/durable definition, with assignment deferred until criteria are approved.
- `top-50` and `top-10`: dynamic badges computed from current global rank, not persisted.
- `contributor`: manual durable award.

Manual assignment/removal is prepared behind the existing fail-closed admin mutation system with a badge-specific MFA scope, required reason, target binding, idempotency and audit. It remains operationally disabled while both mutation switches are false.

## Database and verification

Every new table has explicit RLS, grants and function ACLs. Public leaderboard and badge display use minimal RPC output; browsers never gain broad reads on wallets, holdings, profiles or Auth. `SECURITY DEFINER` functions use a fixed `search_path`, and privileged helpers retain no `PUBLIC` execute.

Migrations are additive and reversible by a reviewed follow-up, not by production data deletion. Validate locally and staging-first with migration dry-run, DB integration tests and query plans before any production migration. Preserve MFA/AAL2, Turnstile, CSP/headers, Auth redirect allowlists, SSL, backup, Gitleaks, CodeQL and all documented residual/deferred-risk decisions. PayPal and real payments remain absent.
