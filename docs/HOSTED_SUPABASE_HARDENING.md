# Hosted Supabase hardening baseline

Verified 2026-08-09 for `FantaFort Staging` (`ibatqfmefkekbsvuterp`) and `FantaFort` (`ytbkcdwpjnqqeqjmulyl`). `supabase/config.toml` is local-only; do not push its localhost Auth URLs to hosted projects.

## Auth

| Setting | Staging | Production |
|---|---|---|
| Site URL | `https://fantafort-staging.vercel.app` | `https://fantafort.com` |
| Redirect allowlist | `/auth`, `/auth?reset=1` on the exact site origin | `/auth`, `/auth?reset=1` on the exact canonical origin |
| Signup | Email/password enabled | Email/password enabled |
| Email confirmation | Required | Required |
| Phone, anonymous, manual linking, OAuth, SAML | Disabled | Disabled |
| Password | 10+ chars, lower/upper/digit/symbol | 10+ chars, lower/upper/digit/symbol |
| Secure password update | Reauthentication required | Reauthentication required |
| JWT / refresh | 3600 seconds; rotation enabled; 10-second reuse interval | Same |
| Session timebox/inactivity/single-session | Disabled | Disabled |
| TOTP | Enrollment and verification enabled; low-AAL bypass disabled | Same; sole production admin has verified TOTP |

Only password login, signup, confirmation and recovery are implemented. No OAuth callback exists. Public redirects are derived from `window.location.origin`, so hosted allowlists must remain exact.

Hosted Auth rate limits are unchanged because they already fit a private alpha: 30 email sends/hour, 30 sign-in/signup requests per IP per 5 minutes, 30 verification requests per IP per 5 minutes, and 150 token refreshes per IP per 5 minutes. Anonymous, SMS and Web3 flows are disabled.

Both projects use complete custom SMTP configurations. Branded confirmation and recovery subjects/templates are synchronized from `supabase/templates`; configuration was validated without exposing credentials, and nonexistent-user recovery requests returned success without generating user data.

## CAPTCHA

Cloudflare Turnstile is enabled on both hosted projects for login, signup and recovery. The frontend consumes each token once and passes it to Supabase as `captchaToken`; expired, failed and consumed widgets reset. Browser retests confirmed accepted challenges for staging login/signup/recovery and production login/recovery. The Turnstile secret remains only in Supabase Auth Bot Protection, never Vercel or the repository.

## Database transport and network

- SSL enforcement is enabled on staging and production. Production completed the documented fast reboot and passed the post-change app, Auth/Data API, CLI, lint and log checks (`POST-SSL: OK`).
- **Deferred non-blocking:** DB Network Restrictions remain open because the workstation and GitHub-hosted runners have no reliable static egress CIDRs. Applying an invented allowlist would create a lockout risk. Revisit only when static egress exists.

## Database posture

Migration `202608090003_security_definer_execution_acl.sql` removes default `PUBLIC`/`anon` execution from all `SECURITY DEFINER` functions, grants service-role access explicitly, and restores only the RPC entry points required by the app. Hosted Security Advisor anonymous warnings dropped from 82 to one intentional PostgREST pre-request hook. Authenticated warnings represent reviewed application RPC entry points with internal authorization checks. Seven `RLS Enabled No Policy` notices are intentional deny-by-default/service-only tables.

Admin mutations remain disabled in Vercel and in `public.admin_runtime_config` on both databases.

## Accepted Free-plan residual

Supabase Leaked Password Protection is unavailable on the Free plan. This is an accepted residual, not a blocking finding. Compensating controls are a 10-character mixed-character password policy, email confirmation, Turnstile on all password-entry/recovery flows, Auth rate limits, refresh-token rotation, TOTP/AAL2 for administration and generic recovery responses. No paid upgrade is required for closure.

## Backups

The organization is on the Free plan: downloadable scheduled backups and PITR are unavailable. `.github/workflows/backup-database.yml` creates weekly logical role/schema/data dumps for staging and production, encrypts them before upload, and retains only encrypted artifacts for 14 days. The Supabase access token is stored as a GitHub Actions secret; the encryption recipient is a repository variable. The private decryption key is outside the repository under the operator profile and must have an offline copy.

Each encrypted archive and the upload artifact are named with environment, run ID and run attempt, so a manually re-run failed job never collides with the prior attempt's artifact. Before and after every dump attempt, the workflow calls the Supabase Management API (`POST /v1/projects/{ref}/database/query`, authenticated with the same access token — no DB password or connection string involved) to terminate any `application_name = 'pg_dump'` backend still open once the CLI subprocess has returned; a legitimate dump session cannot outlive that call, so anything left is orphaned. If termination doesn't actually clear the session, the job fails immediately instead of retrying or proceeding. A failed link/dump attempt is retried at most once (`BACKUP_MAX_ATTEMPTS`) and only after that verified cleanup. `supabase` CLI output is captured to a temp log and only surfaced on failure, redacted for `postgres://` connection strings and `password=` values first, since a dynamically issued DB password from the CLI is not a registered GitHub secret and would otherwise print unmasked.

`workflow_dispatch` accepts an `environment` input (`all` / `staging` / `production`, default `all`) to back up or verify a single environment without touching the other.

A staging public-data dump was restored into isolated local Supabase with triggers disabled only for the restore session; 32 tables and 3,268 rows restored successfully. The temporary dump and restored data were then deleted.

Restore an artifact only in an isolated environment first:

```bash
age --decrypt -i ~/.fantafort/backup_age_ed25519 backup.tar.gz.age > backup.tar.gz
tar -xzf backup.tar.gz
# Apply roles.sql, schema.sql and data.sql to an empty isolated Supabase/Postgres target.
```

Never restore directly over production without a reviewed incident plan and downtime window.
