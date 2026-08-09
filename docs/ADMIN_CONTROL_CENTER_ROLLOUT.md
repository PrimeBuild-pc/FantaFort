# Admin Control Center — review and rollout

Status: the nine reviewed changes are merged. Migrations `190001–190009` are present in both the linked production project and FantaFort Staging as of 24 July 2026. Sensitive runtime features remain fail-closed behind environment flags.

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

- `ADMIN_MUTATIONS_ENABLED` — unset/false;
- `ADMIN_MFA_ENFORCEMENT_ENABLED` — unset/false;
- `ADMIN_ANONYMIZATION_ENABLED` — unset/false.

`profiles_single_admin` remains in place. Additional administrators remain rejected by the database.

## Manual configuration before activation

1. Configure `SUPABASE_SERVICE_ROLE_KEY` only in the server runtime used by admin Auth routes; never expose it through a `NEXT_PUBLIC_` variable.
2. Verify hosted TOTP support without changing existing factors.
3. Enroll and verify the approved admin account before enabling MFA enforcement.
4. Validate recovery redirects and email delivery in an isolated staging project.
5. Apply migrations only after separate approval and backup/schema review.
6. Test the PostgREST pre-request hook in staging before enabling mutations.
7. Enable `ADMIN_MUTATIONS_ENABLED` only after authorization, CSRF and audit tests pass in staging.
8. Keep anonymization disabled until privacy/retention rules and compensation procedures are approved.

No SMTP, Auth redirect, DNS or hosted template changes are part of these PRs.

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
- Vercel server-only environment separation for the service role.
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
