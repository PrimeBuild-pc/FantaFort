# Record of processing activities (GDPR art. 30)

Controller: Lorenzo Massafra, natural person, independent non-professional operator
of the FantaFort project, Italy. No VAT number: the project is a student side project
with no commercial activity. The controller is still a controller — art. 4(7) does not
require a business — and the art. 2(2)(c) household exemption does not apply, because
the service is offered publicly to third parties.
Privacy contact: privacy@fantafort.com · Security contact: security@fantafort.com
No DPO is appointed: art. 37 does not apply (no public authority, no large-scale
regular and systematic monitoring, no large-scale special categories).
Version: 2026-08-14. Review when a processor, purpose or category changes.

The art. 30(5) small-organization exemption does not apply: processing is regular
and not occasional.

## A1 — User accounts and authentication

| | |
|---|---|
| Purpose | Create and secure a player account, sign-in, email confirmation, password recovery |
| Data subjects | Registered public-alpha users (16+) |
| Categories | Email, hashed credentials held by Supabase, username, locale, account status, age and legal-acceptance flags with version and timestamp |
| Legal basis | Art. 6(1)(b) — performance of the service requested by the user |
| Recipients | Supabase (auth + database), Vercel (hosting), Supabase default SMTP |
| Transfers | Outside the EEA under the processors' SCCs and their published DPAs |
| Retention | While the account is active, until a verified deletion request completes |
| Subject rights | Self-service export (`export_account_data`) and deletion request (`request_account_deletion`) from Account settings; anything else via privacy@fantafort.com |
| Security | RLS on every table, security-definer RPCs, encrypted transport, session revocation, Turnstile on auth forms |

## A2 — Gameplay and league activity

| | |
|---|---|
| Purpose | Run leagues, rosters, market, standings, rewards, friends and presence |
| Data subjects | Registered users |
| Categories | League membership and invite codes, rosters, virtual wallet ledger, rewards, badges, cosmetics, friendships, online presence, community preferences |
| Legal basis | Art. 6(1)(b) |
| Recipients | Supabase, Vercel |
| Transfers | As A1 |
| Retention | While the account is active; ledger and integrity records may be kept pseudonymized after anonymization |
| Note | The virtual wallet has no monetary value and no payment processing exists |

## A3 — Security, abuse prevention and error diagnostics

| | |
|---|---|
| Purpose | Protect the service, investigate abuse, debug failures, preserve game integrity |
| Data subjects | Registered users, visitors |
| Categories | Redacted application error records, administrative audit log, admin session and step-up records, rate-limit counters |
| Legal basis | Art. 6(1)(f) — legitimate interest in operating a safe and reliable service |
| Recipients | Supabase, Vercel, GitHub (Actions logs) |
| Transfers | As A1 |
| Retention | Proposed matrix in `docs/admin-data-retention-proposal.md` (audit 24 months, error detail 30 days, aggregates 90 days) — not yet enforced in production |
| Security | Append-only audit, output redaction, per-user ingestion limits |

## A4 — Professional player competitive data

| | |
|---|---|
| Purpose | Build the player roster and compute fantasy scores from published tournament results |
| Data subjects | Competitive Fortnite players who are **not** users of the service |
| Categories | Competitive handle, opaque Epic account id, region, tournament placements and results; for a curated subset also date of birth, earnings snapshot and photograph |
| Legal basis | Art. 6(1)(f) — see `GDPR_LEGITIMATE_INTEREST_PRO_PLAYERS.md` |
| Source | Osirion public competitive API; Liquipedia public player pages (art. 14(2)(f)) |
| Recipients | Supabase, Vercel; the roster is visible to users of the service |
| Transfers | As A1 |
| Retention | While eligible under `docs/PRO_PLAYER_POOL.md`; decay removes inactive accounts |
| Objection | `player_data_objections` deactivates the player immediately and is honoured by every later sync |

## A5 — Support correspondence

| | |
|---|---|
| Purpose | Answer support, privacy and security requests |
| Data subjects | Anyone who writes in |
| Categories | Email address, message content, optionally a Discord handle |
| Legal basis | Art. 6(1)(b) for service requests; art. 6(1)(c) for statutory privacy requests |
| Recipients | The mailbox provider; Discord for general support tickets only |
| Retention | As long as needed to handle the request and evidence its outcome |

## Processors (art. 28)

| Processor | Role | How the DPA is put in force |
|---|---|---|
| Supabase | Authentication, database, transactional email | Organization dashboard → Legal Documents; text at <https://supabase.com/legal/customer-resources/data-processing-addendum>. Includes EU SCCs and the UK addendum. |
| Vercel | Application hosting and edge delivery | Incorporated by reference into the Terms of Service; accepting the ToS is deemed signature of the SCCs it contains. Text at <https://vercel.com/legal/dpa>. Confirm it covers the current plan. |
| GitHub | Scheduled synchronization workflows and their logs | Data Protection Agreement incorporated into the GitHub Customer Terms; no separate signature step. |
| Cloudflare | Turnstile anti-abuse challenge | DPA incorporated by reference into the self-serve Terms; available from the dashboard's legal section. |
| Osirion | Competitive results provider | **Not settled.** Osirion publishes results it collects itself, so it is most likely an independent controller rather than a processor — in which case art. 28 does not apply and no DPA is needed, only accurate source disclosure. Confirm with the provider and record the answer here. |

**Open action:** download each DPA as accepted, note the date, and archive the PDFs
outside the repository. The repo must not hold account or contract identifiers.

## Assessments on file

- DPIA (art. 35): **not required.** No systematic large-scale monitoring, no special
  categories, no profiling with legal or similarly significant effects, no
  automated decision-making under art. 22. Reassess before any real-money feature,
  any behavioural profiling, or any sentiment/AI-driven pricing.
- Legitimate interest assessments: A3 (security, standard operational interest) and
  A4 (documented separately).
- Breach procedure: `SECURITY.md` → "Personal data breach procedure"; every breach,
  notified or not, is logged in `docs/breach-register.md` per art. 33(5).
- Third-party material and image licensing: `/credits` and `THIRD_PARTY_NOTICES.md`.
