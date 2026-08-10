# Granular badge administration capability

Status: implemented, disabled everywhere. Security baseline: `docs/SECURITY_AUDIT_CLOSURE.md` is invariant.

## Why a separate capability

Before this change, assigning a badge required turning on `ADMIN_MUTATIONS_ENABLED` and
`admin_runtime_config.mutations_enabled`, which simultaneously unlocks wallet adjustments, role
changes, account status changes, session revocation, recovery mail and (with its own extra switch)
anonymization. Awarding a cosmetic badge is not worth that blast radius.

Badge assignment is now its own least-privilege capability. Neither switch implies the other in
either direction.

| | General admin mutations | Badge mutations |
|---|---|---|
| Server switch | `ADMIN_MUTATIONS_ENABLED=true` **and** a server Supabase key present | `ADMIN_BADGE_MUTATIONS_ENABLED=true` |
| Database switch | `admin_runtime_config.mutations_enabled` | `admin_runtime_config.badge_mutations_enabled` |
| Unlocks | wallet, roles, account status, session revocation, recovery, anonymization | `badge.assign` and `badge.remove` only |
| Step-up scopes | `role`, `economy`, `recovery`, `anonymize`, `account_status`, `session_revoke` | `badge` |

The badge capability deliberately does not require a server Supabase key: the whole badge path runs
on the administrator's own AAL2 session through `admin_set_user_badge`. Requiring a service-role key
would have made the capability impossible to use on Vercel, where no privileged key exists by design.

## Where the gate is enforced

Four independent layers, each fail-closed:

1. **Server route** — `/api/admin/step-up` rejects `scope: 'badge'` unless `ADMIN_BADGE_MUTATIONS_ENABLED=true`,
   and rejects every other scope unless `ADMIN_MUTATIONS_ENABLED=true`. `/api/admin/users/[id]/badges`
   goes through `prepareAdminMutation(request, adminBadgeMutationsEnabled())`: same-origin only,
   AAL2-authorized, 404 when the capability is off.
2. **Grant creation** — the `admin_step_up_grants_runtime_guard` trigger reads
   `admin_runtime_config` and picks the switch by `new.scope`. A missing config row or a missing
   value evaluates to `false`.
3. **Grant consumption** — `admin_set_user_badge` re-reads `badge_mutations_enabled` before doing any
   work, so flipping the switch off invalidates grants that were already issued (TTL is 5 minutes).
4. **Grant binding** — `consume_admin_step_up_grant(token, 'badge', target)` requires the right admin,
   the right auth session, the right scope, the right target, an unexpired grant and one-time use.

## Threat model

| Threat | Control |
|---|---|
| Compromised admin session without MFA | `authorize_admin_request()` requires AAL2; AAL1 sessions are denied in SQL, not only in the UI |
| Stolen step-up token | 5-minute TTL, one-time consumption, bound to admin + auth session + scope + target |
| Confused-deputy: badge grant reused for another mutation | Every mutation RPC consumes its own scope; a `badge` grant is rejected by wallet/role/status RPCs and vice versa |
| Capability creep after enabling badges | `ADMIN_BADGE_MUTATIONS_ENABLED` is read only by the badge route and the `badge` step-up scope; `check:admin` fails if it appears in any other admin route |
| CSRF / cross-site mutation | `rejectCrossOriginMutation` on every mutating admin route |
| Self-award or privilege escalation | `target_user_id = auth.uid()` is rejected; admin targets are rejected; badges are public metadata only and never consulted for authorization |
| Fabricated Founding 50 award | `founding-50` is accepted only for an account that `admin_preview_founding_50()` currently returns **and** marks `currently_awardable` |
| Unmarked technical account taking a founding slot | `test_marker` is mandatory for technical accounts, enforced by `check:admin` and by `makeUser` |
| Manual award of a computed badge | `assignment_type = 'dynamic'` is excluded from assignable badges, plus a table trigger on `user_badges` |
| Bulk abuse | 20 step-up grants / 10 minutes per admin, 50 badge actions / hour per admin |
| Undetected action | Append-only `admin_audit_log` row with mandatory reason, request id and idempotency key |

Idempotency: replaying the same `idempotency_key` returns the recorded before/after state without a
second write; reusing that key for a different badge or target raises a conflict.

## Badge semantics

- `top-10`, `top-50` — `dynamic`. Computed from the live global rank, never written to `user_badges`.
- `founding-50` — `verified`. One-time award after administrative verification of the first real
  accounts. `automatic` was misleading: no job assigns it, and it is only accepted for accounts the
  preview already lists.
- `beta-tester` — `automatic`, criteria still deferred.
- `contributor` — `manual`.

Assignable set = every badge whose `assignment_type` is not `dynamic`.

## Founding 50 eligibility

The badge means: *one of the first 50 real FantaFort accounts registered*. The system is defined
independently of whether 50 real accounts exist yet.

### Authoritative criteria

`admin_preview_founding_50()` (AAL2, read-only) returns the first 50 accounts ordered by
`auth.users.created_at`, then profile id. Exclusion uses only stable database facts:

| Excluded | Source of truth |
|---|---|
| Administrators | `profiles.is_admin` — a founding badge recognises early players, not the operator |
| Technical accounts (synthetic, security-test, automation) | `auth.users.raw_user_meta_data ->> 'test_marker'` |
| Anonymized profiles | `profiles.account_status = 'anonymized'` |
| Soft-deleted auth users | `auth.users.deleted_at` |
| Banned auth users | `auth.users.banned_until` |

**Nickname shape and email domain are not eligibility criteria.** They were only supplementary
sanity checks during a one-off manual review, they were never applied by
`admin_preview_founding_50()`, and they must not become permanent filters: they are unstable
heuristics and a real player may legitimately match them.

**An unconfirmed email is not an exclusion criterion.** `email_confirmed` is reported for
information only and never blocks the award.

### Historical slot versus current awardability

The preview reports both, so a blocked account is visible rather than silently missing:

- `historical_candidate` — the account holds a position among the first 50 real accounts. This is a
  historical fact and does not change when the account's status changes.
- `currently_awardable` — the badge can be granted right now (`account_status = 'active'`).
- `award_block_reason` — why not, when it is not awardable; `suspended` today, and any future
  non-active status automatically.

A suspended account therefore **keeps its historical slot** — it is not renumbered away and does not
free the position for a later registrant — but cannot receive the badge until it is active again.
`admin_set_user_badge` accepts `founding-50` only for an account the preview currently lists **and**
marks `currently_awardable`. The preview itself never awards anything.

### Technical-account invariant

Because `test_marker` is the only authoritative signal separating technical accounts from real
players — for Founding 50 and for the public leaderboard alike — **every technical, synthetic,
security-test or automation account created against staging or production must carry
`user_metadata.test_marker` at creation time.** An unmarked technical account would silently occupy
a Founding 50 slot and appear on the global leaderboard.

This is enforced, not merely documented:

- `check:admin` fails if any script creates accounts without a `test_marker`;
- `makeUser(name, false)` in `scripts/check-social.mjs` throws unless the target is a local,
  disposable database.

Retiring a technical account keeps the marker (`CHECK_SOCIAL_RETIRED`, `ANONYMIZED`), so exclusion
survives the account's lifecycle.

## Activation procedure (not performed)

Both switches are required; either one alone leaves badges disabled.

1. Apply `202608110001_granular_badge_admin.sql` and `202608110002_founding_50_awardability.sql` to
   the target project (staging first).
2. Database: `update public.admin_runtime_config set badge_mutations_enabled = true, updated_at = now() where singleton;`
   — service role only; ordinary and admin sessions cannot write this table.
3. Vercel: add `ADMIN_BADGE_MUTATIONS_ENABLED=true` (Production, sensitive) and redeploy.
4. Verify `/admin/badges` reports badge mutations enabled and general mutations still disabled.
5. Perform the awards from `/admin/users/<id>`, each with an explicit reason and a TOTP code.

## Immediate deactivation

Either step is sufficient and takes effect on the next request; do both.

1. Database: `update public.admin_runtime_config set badge_mutations_enabled = false, updated_at = now() where singleton;`
   This also invalidates step-up grants already issued, because the capability is re-read at
   consumption time.
2. Vercel: set `ADMIN_BADGE_MUTATIONS_ENABLED=false` (or remove it — absent means disabled) and redeploy.

Optional containment: `delete from public.admin_step_up_grants;` revokes every outstanding grant.

## Auditability and rollback

Every award writes an `admin_audit_log` row (`badge.assign` / `badge.remove`) with actor, target,
reason, request id, idempotency key and before/after state. The log is append-only; the admin audit
reader exposes only hashed references, never raw ids.

Rollback of an individual award is a `badge.remove` through the same gated path — itself audited.
Rollback of the capability is the deactivation procedure above. Rollback of the migrations is a
reviewed follow-up migration (drop the column, restore the previous trigger body and the previous
`admin_preview_founding_50`), not a production data deletion; the column is additive and defaults to
`false`, so leaving it in place while disabled is already the safe state.
