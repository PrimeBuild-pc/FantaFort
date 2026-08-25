# Security audit closure — Free-plan baseline

Closure update: 2026-08-09. Scope: repository, GitHub, Vercel, hosted Supabase staging/production and authorized synthetic staging tests. Production testing remained passive except CAPTCHA challenges against nonexistent synthetic addresses. No real user data was modified.

## Fixed and verified

| Area | Status and evidence |
|---|---|
| FF-01 admin MFA/step-up | Fixed in `202608080001_security_audit_remediation.sql`; AAL1, missing/wrong scope, target, session and replay paths are denied. TOTP reaches AAL2. Runtime and DB mutation switches remain false. |
| FF-02 strategy BOLA | Fixed by owner-only RLS; cross-user reads are denied in integration tests. |
| FF-03 invite entropy/throttle | Fixed with 16-hex codes, legacy invalidation and bounded failure tracking. |
| FF-04 dependencies | Production and full `npm audit` gates pass. |
| FF-07 sandbox top-up | Closed by removal: the euro sandbox wallet, its ledger and `mock_top_up` were dropped in `202608250001_coin_shop_and_avatars.sql`. No payment surface remains. |
| Hosted Auth | Retest found production preview wildcards had reappeared in the redirect allowlist. The allowlists were restored staging-first to the two exact `/auth` and `/auth?reset=1` URLs and reverified. Custom SMTP, password policy, refresh rotation, rate limits, email confirmation, Turnstile and TOTP/AAL2 are verified. |
| Database ACL/transport | `SECURITY DEFINER` execution ACL migration applied; SSL enforcement verified on both projects and production post-reboot checks ended `POST-SSL: OK`. |
| Backups | Weekly staging/production logical dumps are encrypted before artifact upload, retained 14 days, and a restore drill succeeded in an isolated local database. |
| CSP | Enforced policy blocks script attributes, isolates style element sources, keeps only the inline compatibility needed by Next.js/React style attributes, and limits Turnstile to Cloudflare. A stricter no-inline policy is also emitted Report-Only. |
| Osirion | All consumers now share bounded fetching: abort/timeout, 15 MB ceiling, at most two retries, structural/type/range/date/HTTPS validation and record ceilings. Sync fetches and validates every provider payload before its first write; idempotent chunked upserts handle DB retry safely. |
| CodeQL | Existing fail-on-any-result SARIF parser remains the merge gate. SARIF upload is enabled with only `actions:read`, `contents:read` and `security-events:write`. |
| Secrets | Public history is sanitized; Gitleaks, GitHub Secret Scanning and Push Protection are active with zero open alerts. Vercel has no privileged Supabase/Postgres/PayPal secret variables. |

## Authenticated staging security retest

A production-like synthetic retest covered:

- authenticated AAL1 and AAL2 sessions, refresh and post-revocation denial;
- horizontal wallet/profile writes and cross-user reads under RLS;
- direct ordinary-user access to admin pages/RPCs/routes;
- fail-closed mutation config and denied step-up grant creation;
- same-origin and hostile-origin admin POST attempts;
- public pages, invalid provider parameters, generic errors, hidden environment/Git paths and client response secret patterns;
- browser Turnstile challenges for staging login, signup and recovery and production login/recovery;
- local database integration for the full positive/negative grant matrix, idempotency, replay, scope, target and session binding without enabling hosted admin mutations.

Synthetic hosted accounts are suspended and long-banned rather than deleted because account wallets, immutable ledgers and audit references must remain internally consistent. Their metadata carries a retired test marker. Transient synthetic `app_errors` rows were removed; immutable ledger/audit records were not altered. Production contained no marked synthetic accounts.

The current Strix source+staging run was attempted in the authorized non-destructive scope but could not start because its previously stored external LLM credential is invalid; the stale credential and empty run artifacts were removed. The earlier completed Strix remediation retest reported no confirmed vulnerabilities. The current custom authenticated test above supplies the session/RLS coverage that CAPTCHA prevents a headless scanner from assuming.

## Artifact and retention hygiene

- Encrypted database artifacts: explicit 14-day retention.
- Repository Actions artifact/log default: reduced from 90 to 30 days.
- Security tests do not upload tokens, credentials, screenshots, raw database payloads or PII.
- Audit and wallet ledgers remain append-only; cleanup uses suspension/ban and removes only transient rows.
- The ignored stale Vercel production environment export containing obsolete privileged variables was removed from the workstation.
- The local backup `age` identity had inherited read access for the sandbox-users group; its ACL was corrected to the operator, SYSTEM and Administrators only.

## Incident: orphaned backend and local CLI password disclosure (2026-08-11)

A production `pg_dump` inside `.github/workflows/backup-database.yml` failed on an SSL error and left an orphaned backend on the production database, which later blocked a migration. Separately, during local investigation the Supabase CLI printed the production database password to the terminal; that password was rotated and the local CLI session was removed. No local Supabase credentials were used for the workflow hardening below.

Compensating controls: the backup workflow now terminates any residual `application_name = 'pg_dump'` backend via the Supabase Management API (token-authenticated, no DB password/connection string) before and after every dump attempt, fails the job outright if a residual session survives termination, and retries a failed link/dump at most once and only after that cleanup is verified. CLI output is captured and redacted for connection strings/passwords before ever reaching the job log. See `docs/HOSTED_SUPABASE_HARDENING.md` § Backups.

## Historical credentials

The prior audit recorded 15 redacted historical matches representing three JWTs (including a service role) and one PayPal client secret. No old credential was used for authentication during closure.

Automated evidence:

- the legacy public repository and its reachable history were deleted;
- current reachable history passes Gitleaks and GitHub has zero open secret-scanning alerts;
- Supabase Management API lists only the expected healthy staging and production projects;
- the prior audit established that current local Supabase values do not match the historical values;
- both Vercel projects have no service-role/secret key, JWT secret, database password/URL or PayPal client secret.

Final PayPal decommissioning update (2026-08-10):

- the tracked repository, package manifests, lockfile, runtime routes, webhook/API paths, environment example, workflows and application documentation contain no PayPal integration, SDK, dependency, checkout or real-payment implementation;
- neither the repository nor either Vercel project contains a PayPal client ID, secret or `PAYPAL_*` environment variable; the remaining security-test pattern only prevents such a value from reaching a client response;
- the manual PayPal Developer Dashboard control found no Live REST API app;
- Sandbox contains only PayPal's provider-generated Default Application, which FantaFort does not use; its existing secret was not read, tested, replaced or supplemented, and no new credential was created during remediation;
- **historical PayPal environment not provable** from the retained redacted evidence. No authentication was attempted with the historical credential.

The old integration is permanently decommissioned. The provider-generated Sandbox default is non-blocking because it is unused and cannot be removed from the observed UI without creating or using credentials.

## Accepted residual risk

1. **Supabase Leaked Password Protection:** unavailable on Free. Accepted with mixed-character 10+ password policy, confirmation email, Turnstile, Auth rate limits, refresh rotation, generic recovery responses and TOTP/AAL2 administration. It is not a closure blocker.
2. **Static Next.js CSP inline compatibility:** `script-src 'unsafe-inline'` remains for Next.js bootstrap/JSON-LD and `style-src-attr 'unsafe-inline'` remains for existing React style props. Script attributes are blocked and a strict no-inline Report-Only policy is emitted. A per-request nonce refactor is disproportionate without a demonstrated XSS sink.
3. **Free-plan recovery point:** provider PITR/downloadable backups are unavailable; encrypted weekly logical backups plus the successful restore drill are the compensating control.

## Deferred non-blocking

**DB Network Restrictions:** defer until the workstation and CI runners have reliable static egress CIDRs. An allowlist based on dynamic addresses would risk administrative and recovery lockout. Do not apply one before static egress exists.

## Manual evidence still required

- Independent collaborator approval is required by the protected-branch ruleset for every hardening PR.
- Keep an offline/password-manager copy of the `age` backup identity; repository and cloud artifacts must never contain it.
