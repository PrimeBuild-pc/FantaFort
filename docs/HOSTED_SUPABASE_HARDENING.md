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

## CAPTCHA rollout

The auth page supports Cloudflare Turnstile for login, signup and recovery through `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. The token is consumed once and passed to Supabase as `captchaToken`; expired, failed and consumed widgets reset. CSP permits only Cloudflare's Turnstile origin.

Keep hosted CAPTCHA disabled until the branch containing this support is deployed and the matching site key exists in Vercel. Roll out staging first, test all three flows, then repeat in production. The Turnstile secret belongs only in Supabase Auth Bot Protection, never Vercel or the repository.

## Database transport and network

- Staging SSL enforcement: enabled and tested through CLI, Data API and the deployed app.
- Production SSL enforcement: pending a maintenance window because Supabase documents a fast database reboot when this setting changes.
- Network restrictions: open IPv4/IPv6. Vercel has no direct PostgreSQL connection, but Supabase CLI administration currently comes from a workstation without a guaranteed static egress CIDR. Do not invent an allowlist that can block migrations or emergency access.

## Database posture

Migration `202608090003_security_definer_execution_acl.sql` removes default `PUBLIC`/`anon` execution from all `SECURITY DEFINER` functions, grants service-role access explicitly, and restores only the RPC entry points required by the app. Hosted Security Advisor anonymous warnings dropped from 82 to one intentional PostgREST pre-request hook. Authenticated warnings represent reviewed application RPC entry points with internal authorization checks. Seven `RLS Enabled No Policy` notices are intentional deny-by-default/service-only tables.

Admin mutations remain disabled in Vercel and in `public.admin_runtime_config` on both databases.

## Backups

The organization is on the Free plan: downloadable scheduled backups and PITR are unavailable. `.github/workflows/backup-database.yml` creates weekly logical role/schema/data dumps for staging and production, encrypts them before upload, and retains only encrypted artifacts for 14 days. The Supabase access token is stored as a GitHub Actions secret; the encryption recipient is a repository variable. The private decryption key is outside the repository under the operator profile and must have an offline copy.

A staging public-data dump was restored into isolated local Supabase with triggers disabled only for the restore session; 32 tables and 3,268 rows restored successfully. The temporary dump and restored data were then deleted.

Restore an artifact only in an isolated environment first:

```bash
age --decrypt -i ~/.fantafort/backup_age_ed25519 backup.tar.gz.age > backup.tar.gz
tar -xzf backup.tar.gz
# Apply roles.sql, schema.sql and data.sql to an empty isolated Supabase/Postgres target.
```

Never restore directly over production without a reviewed incident plan and downtime window.
