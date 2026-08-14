# Legitimate interest assessment — professional player data

Covers record A4 in `GDPR_RECORD_OF_PROCESSING.md`. Version 2026-08-14.

The data subjects are competitive Fortnite players who never registered with
FantaFort. They are the only group whose data is not obtained from them, so this
processing needs both a documented art. 6(1)(f) balancing test and an art. 14 notice.

## 1. Purpose test

Building a fantasy game requires a roster of real competitors and their published
tournament results; without them the service cannot exist. The interest is a real,
present and lawful business interest, not speculative. Roughly 7,000 players across
four tiers and three regions (EU/NAC/NAW) are in scope, per `PRO_PLAYER_POOL.md`.

## 2. Necessity test

Only data required to identify a competitor and score them is processed:
competitive handle, opaque Epic account id, region, placements and results. There is
no less intrusive alternative — anonymized or invented players would not be the same
service. Categories deliberately **not** processed: real name (except where the
curated subset publishes it), contact details, address, nationality documents,
in-game behavioural telemetry, any special category under art. 9.

The curated subset (`public/players`) adds date of birth,
earnings snapshot and photograph. This is the narrowest documented extension and
should not be broadened without revisiting this assessment and the licensing
position of the images.

## 3. Balancing test

**In favour of processing**
- All source data is already public: tournament leaderboards published by the
  organizer, and Liquipedia pages the players' own scene maintains.
- It relates to public professional activity, not private life.
- Competitive results being reused by fantasy games, statistics sites and media is a
  well-established and reasonably expected practice in esports.
- No advertising, profiling, scoring of the individual, or automated decision with
  legal or similarly significant effects about them.
- The service is free, has no real-money element, and does not suggest endorsement.

**Against processing**
- The players never chose to appear and cannot be expected to monitor where their
  results are reused.
- Roster inclusion attaches a virtual price and rarity to a named person, which is a
  characterization they did not consent to, even if it carries no monetary value.
- Photographs and date of birth are more identifying than results alone.

**Mitigations applied**
- Public art. 14 notice on `/privacy` in all five UI languages, naming categories,
  sources, basis, retention and rights.
- Unconditional roster removal on objection, honoured durably: an entry in
  `player_data_objections` deactivates the player at once and the pool sync drops the
  account before it is imported (`scripts/sync-player-pool.mjs`). Without that list
  the importer would re-create the player on the next run.
- No contact details are collected, so the data cannot be used to reach the player.
- Published, auditable methodology for how prices and tiers are derived.
- Photographs limited to a curated, attributed subset; missing metadata is shown as
  unavailable and never fabricated.

**Conclusion:** the interest is not overridden by the players' rights and freedoms,
provided the mitigations above stay in place. Reassess if the game monetizes, if the
photograph set grows, or if any player-level characterization beyond price/tier is
introduced.

## 4. Article 14 notification

Direct notification of every player would require contact details that FantaFort
deliberately does not hold, and obtaining them for ~7,000 people solely to send a
notice would be more intrusive than the processing itself. This is a
**disproportionate effort** case under **art. 14(5)(b)**, which the Recital 62
conditions support. As art. 14(5)(b) requires, the information is instead made
publicly available on `/privacy`, reachable without an account, in every supported
language.

Where a player makes contact, the full art. 14 information is given directly.

## 5. Rights handling runbook

- **Access / rectification / erasure / objection** arrive at privacy@fantafort.com.
- Verify the requester is the player (public profile, team, or organizer contact) —
  do not act on an unverified third-party claim about someone else's data.
- To honour an objection or erasure:
  `insert into player_data_objections (account_id, handle, note) values (…);`
  The trigger deactivates the player immediately; the exclusion then holds across
  every future sync.
- Rosters and historical results keep the opaque account id so referential integrity
  survives. Erasing those rows outright is an admin-reviewed action, not routine.
- Respond within one month (art. 12(3)).

## 6. Separate from data protection

Photographs raise two issues this assessment does **not** resolve:

1. **Copyright** — every photograph has a rightsholder. Reuse needs a licence
   regardless of GDPR. Liquipedia's CC BY-SA licence requires visible attribution
   next to the image, not only in `THIRD_PARTY_NOTICES.md`.
2. **Image rights** — arts. 96–97 L. 633/1941 and art. 10 c.c. protect the subject
   independently of the photographer's rights, and the notoriety exception narrows
   sharply once the use becomes commercial.

Neither is cured by a lawful GDPR basis. Keep the current policy: no photograph
without an explicit licence, and "unavailable" for everyone else.

Checking the file pages in August 2026 removed two of the eight portraits: Bugha's
was "all rights reserved" with permission granted to Liquipedia only, and Mongraal's
came from the Red Bull Content Pool under Red Bull's own editorial terms. Neither was
a CC BY-SA file. The remaining five credited portraits are by Michal Konkol; one is
still unattributed pending its file page. Being hosted on a wiki is not a licence,
and that check has to be repeated before any new image is added.
