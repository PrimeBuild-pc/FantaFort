# Public alpha readiness

Target: limited, free public alpha with no advertising, payments, prizes or monetization.

## Automated and implemented

- [x] CI: production-dependency audit, lint, production build, API, auth and admin checks.
- [x] CodeQL, Dependabot alerts/security updates and SHA-pinned GitHub-owned actions.
- [x] Privacy, terms, cookie and support pages.
- [x] Signup requires age 16+ confirmation and acceptance of versioned terms/privacy metadata.
- [x] Account page exposes a truthful verified deletion-request process instead of the disabled destructive RPC.
- [x] Exact Epic fan-content disclaimer is visible in public and authenticated footers.
- [x] Production security headers, sitemap, robots and public SEO checks.
- [x] Sync fails closed on missing secrets and retries transient provider failures.
- [x] Separate Supabase project `FantaFort Staging` exists; the isolated integration check passes there.

## Known development-only advisory

Dependabot alert `#83` was reviewed and dismissed as tolerable risk: the affected old `minimatch`/`brace-expansion` branch is limited to the Next.js lint toolchain, receives repository-controlled glob patterns and is absent from production dependencies. ESLint 10 currently breaks the bundled React plugin, while forcing `brace-expansion` 5 breaks the old `minimatch` API. CI continues to block production dependency advisories with `npm audit --omit=dev --audit-level=high`; Dependabot will keep proposing compatible toolchain updates.

## Manual gates before inviting external users

- [ ] Publish the operator's full legal identity and postal/contact details in privacy and terms.
- [x] Send and receive test messages through the configured Cloudflare routes for `support@fantafort.com`, `privacy@fantafort.com` and `security@fantafort.com`.
- [x] Verify the existing Resend SMTP configuration, SPF, DKIM and DMARC; test signup confirmation and password recovery in staging and production.
- [x] Add the verified official Discord invitation to `/support`.
- [x] Configure Discord private tickets, staff-only access and a short retention policy. Never request passwords, recovery codes, tokens or identity documents there.
- [ ] Define and test the operator procedure for verified privacy requests. Use email, not Discord, for privacy or account ownership evidence.
- [ ] Approve the retention policy and test the existing admin suspend/anonymization flow in staging before enabling its production flags.
- [ ] Add external uptime/data-freshness monitoring. GitHub scheduled workflows are best-effort and may start late.
- [ ] Confirm Supabase backup availability and perform one staging restore drill.
- [ ] Run a small invite-only test across mobile/desktop and all supported languages.

## Deferred external gates

- [ ] Obtain legal review or written permission for any future commercial objective involving Epic IP.
- [ ] Confirm Osirion terms, attribution, rate limits and public-use permission.
- [ ] Verify the reusable license of every player image or remove it.

## Discord scope

Discord is acceptable for general alpha support, bug reports and moderation when tickets are private. It is not the authoritative channel for privacy requests, security disclosures or account recovery; those use the domain email addresses above.

## Launch rule

Do not advertise or open registration broadly until every manual gate is complete. Monetization remains out of scope regardless of alpha readiness.
