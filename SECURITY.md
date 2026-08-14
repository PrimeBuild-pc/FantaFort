# Security policy

Report suspected vulnerabilities privately to `security@fantafort.com`.

Include the affected URL or component, reproducible steps and impact. Do not include passwords, session tokens, API keys, private user data or destructive proof-of-concept actions. Do not open a public Discord ticket or GitHub issue for an unpatched vulnerability.

FantaFort will acknowledge a report as soon as practical during the limited alpha and coordinate disclosure after a fix. This policy does not authorize access to other users' accounts or data, denial of service, social engineering, automated high-volume testing or any action that damages availability or integrity.

## Personal data breach procedure (GDPR arts. 33 and 34)

The 72-hour clock in art. 33(1) starts when the controller becomes **aware** of a
breach, not when the investigation finishes. A notification may be made in phases
(art. 33(4)) — an incomplete notification on time beats a complete one that is late.

Controller and single point of contact: `privacy@fantafort.com`.

### 1. Contain and record (immediately)

- Revoke affected sessions, rotate any exposed key, and close the entry point.
- Never rotate or wipe evidence before capturing it: preserve the relevant
  `app_errors` rows, `admin_audit_log` entries and provider logs first.
- Open an entry in the breach register (below). Record the time awareness began — that
  timestamp is what the 72 hours are measured from.

### 2. Assess (same day)

Establish, as far as known: what happened, which categories and how many data
subjects and records, likely consequences, and mitigations taken or proposed. A
breach means any accidental or unlawful destruction, loss, alteration, unauthorized
disclosure of, or access to personal data — availability loss counts, not only
disclosure.

### 3. Notify the supervisory authority (within 72 hours)

Notify the **Garante per la protezione dei dati personali** unless the breach is
unlikely to result in a risk to the rights and freedoms of natural persons. Use the
Garante's official online notification form at
<https://www.garanteprivacy.it/home/modulistica-e-servizi-online>. If notification is
later than 72 hours, it must state the reasons for the delay.

If the reasoned conclusion is *not* to notify, write that reasoning into the register
entry. Art. 33(5) requires the assessment to be documented either way.

### 4. Notify affected users (without undue delay)

Required by art. 34 when the breach is likely to result in a **high** risk to
individuals. Communicate in clear plain language: what happened, the likely
consequences, the measures taken, and the contact point. Notification to individuals
is not required if the data was rendered unintelligible (e.g. strong encryption), if
subsequent measures removed the high risk, or if it would involve disproportionate
effort — in which case make a public communication instead.

Credentials are stored hashed by Supabase and FantaFort never receives readable
passwords, but session tokens, email addresses and account activity are not
protected by that exemption.

### 5. Register the breach (always)

Every breach is recorded in `docs/breach-register.md` — including those not notified —
with: date and time of awareness, description, categories and approximate number of
subjects and records, likely consequences, measures taken, the notification decision
and its reasoning, and the date of any notification made.

### Processor breaches

Supabase, Vercel, GitHub and Cloudflare must notify the controller without undue
delay under art. 33(2). A breach reported by any of them starts the same procedure,
with awareness dated from their notification. Keep their status pages and security
contacts reachable from the register entry.
