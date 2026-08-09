# Admin Control Center — review and rollout

Status: the reviewed admin changes are merged. Migrations through `202608080001` are present in the hosted projects. Repository migration `202608090001_admin_runtime_fail_closed.sql` adds an independent database-side mutation switch defaulting to disabled; it must follow the normal staging-first migration process and is not applied by Vercel.

## Historical review order

1. #15 — Safety foundation
2. #16 — Server-side API authorization
3. #17 — MFA and step-up foundation
4. #18 — Read-only users
5. #19 — Suspension and sessions
6. #20 — Guarded role changes
7. #21 — Atomic economy controls
8. #22 — Flagged anonymization
9. #23 — Audit and operations overview

## Migration state and approval

No admin migrations are pending on the linked production project or staging. Future migrations still require database-first ordering, backup/schema review and staging verification before production.

Retry/compensation is documented in `docs/admin-anonymization-recovery.md`; the non-binding retention proposal is in `docs/admin-data-retention-proposal.md`.

## Default feature state

All sensitive capabilities are fail-closed:

- MFA/AAL2 is always enforced when `NODE_ENV=production`; an absent, `false` or malformed `ADMIN_MFA_ENFORCEMENT_ENABLED` cannot disable it. Configure the exact value `true` in Vercel so intent is visible.
- `ADMIN_MUTATIONS_ENABLED` enables routes only with the exact value `true` **and** a non-empty server-only Supabase key. Missing, `false`, malformed or keyless configurations remain disabled.
- `ADMIN_ANONYMIZATION_ENABLED` additionally requires effective mutations plus the exact value `true`; it cannot enable anonymization independently.
- `202608090001_admin_runtime_fail_closed.sql` independently rejects creation of database mutation grants while its private switch is false, which is the default.

`profiles_single_admin` remains in place. Additional administrators remain rejected by the database.

## Vercel environment baseline while mutations are disabled

Apply the same admin values to the Production environment of both independent Vercel projects:

| Variable | Required value |
|---|---|
| `ADMIN_MFA_ENFORCEMENT_ENABLED` | `true` |
| `ADMIN_MUTATIONS_ENABLED` | `false` |
| `ADMIN_ANONYMIZATION_ENABLED` | `false` |

Only `NEXT_PUBLIC_SUPABASE_URL` and one browser-safe client key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` preferred, otherwise the legacy anon key) are needed by the web runtime. Do not configure `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, database passwords or Postgres connection strings in either Vercel project while mutations remain disabled. Those credentials are not used by the current web runtime.

Changes to Vercel environment variables require a redeploy. Preview scope should be configured only if that Vercel project actually serves preview deployments, using the same fail-closed admin values and the matching Supabase project.

## Separate approval before future activation

1. Keep the database runtime switch false until a reviewed activation window.
2. Verify hosted TOTP, recovery redirects and email delivery in isolated staging.
3. Apply migrations staging-first after backup/schema review.
4. Test authorization, CSRF, audit, PostgREST direct calls and compensation paths.
5. Introduce a server-only Supabase key only after its runtime scope and rotation process are approved.
6. Enable mutations only when both the Vercel and database controls are intentionally changed.
7. Keep anonymization disabled until privacy/retention rules and compensation procedures are approved.

## Residual risks

- The application still stores browser Auth sessions using the existing Supabase client architecture; XSS remains a high-impact risk for admins.
- MFA enrollment UI and recovery/break-glass operations need a reviewed operational runbook.
- Auth ban/unban and database status changes span two systems and cannot be one transaction; failures remain fail-closed and require retry.
- Anonymizing Auth before the final database RPC can leave an account Auth-anonymized but application-suspended if the final step fails.
- Append-only wallet triggers intentionally prevent ordinary hard-delete cleanup; disposable local databases should be reset instead.
- The current single-admin constraint creates an availability risk until a separately approved multi-admin design is enabled.
- Audit proves application actions, not actions performed directly by database owners or external Supabase management access.
- League, marketplace, tournament and content administration remain out of scope until user management is approved.

## Tests still requiring staging or production-like infrastructure

- Hosted Supabase MFA enrollment/challenge and AAL2 token behavior.
- Auth ban/unban and recovery email delivery.
- Future Vercel server-only key separation, only if admin mutations are approved.
- PostgREST pre-request hook behavior during token refresh and session revocation.
- CSP/XSS review with an authenticated admin session.
- Concurrent admin actions across multiple Vercel instances.
- Migration timing and lock impact with a production-size snapshot.
- Email/UUID confirmation UX and anonymization compensation drill.

No destructive production test is required or permitted.

## Decisions required before activation

- whether and when to replace `profiles_single_admin` with a multi-admin model;
- approved MFA enrollment and break-glass process;
- mutation rate limits and operational alert thresholds;
- retention policy for audit, client errors and anonymized account data;
- whether recovery email is permitted as an admin action;
- maximum admin wallet adjustment beyond the current 100,000-coin hard cap;
- staging project and approval owner for Auth/service-role tests;
- explicit approval for each hosted migration and each server feature flag.
