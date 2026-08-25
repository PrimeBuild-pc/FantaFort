# Cosmetic shop and profile emblems

Migration: `supabase/migrations/202608250001_coin_shop_and_avatars.sql`. Page: `/shop`.

## One currency

The euro "sandbox wallet" is gone. `profiles.wallet_cents`, `sandbox_top_up_ledger` and
`mock_top_up()` were dropped, together with the mock top-up panel in the account page and
the `balance` / `topUp` / `sandboxNotice` dictionary entries. Nothing in the product now
displays a monetary amount or offers a payment-shaped action.

Coins (`C`, `account_wallets.balance`) are the only balance. They are earned in the game,
cannot be bought with money and cannot be cashed out.

FantaPoints (`profiles.reward_points`) stay as a league-win counter shown on the account
page. They no longer buy anything: `buy_name_style()` was dropped and name styles moved
into the coin shop. Everyone who had already unlocked a name style keeps it — the
migration backfills `user_cosmetics` from `profiles.name_style`.

## Catalogue

| Table | Purpose |
| --- | --- |
| `cosmetics` | slug, kind (`avatar` / `name_style`), price in coins, sort order, active flag |
| `user_cosmetics` | what an account owns |
| `profiles.avatar_style` | equipped emblem, `default` until something else is bought |
| `profiles.name_style` | equipped nickname style, unchanged column |

Display names and descriptions are **not** in the database: item names are proper nouns
(`Blaze`, `Aurora`, …) and live in `src/lib/cosmetics.ts`, while the surrounding page copy
is translated in `src/app/shop/page.tsx`. A single English string per row could not serve
five UI languages.

`buy_cosmetic(slug, request_id)` follows the same discipline as a trade: it locks the
wallet row, replays on a known `request_id`, prices from the catalogue and never from the
client, writes a `cosmetic_purchase` row into `wallet_transactions`, and equips the item.
`equip_cosmetic(kind, slug)` requires ownership; `default` is the only slug that can be
equipped without it.

`get_global_leaderboard` and `get_public_lineup` return `avatar_style`, so the emblem is
what other managers see next to a nickname in the ranking.

Adding an item is data-only: insert a row in `cosmetics`, add its display name to
`COSMETIC_NAMES`, and add a `.avatar-<slug>` (or `.name-<slug>`) rule in `globals.css`.

## Why uploaded profile pictures are not implemented

Emblems are curated themes, not user files. Letting accounts upload a picture that is
shown on a public leaderboard would turn FantaFort into a user-generated-content host,
which brings obligations the project is not currently equipped for:

- **Moderation and takedown.** A public avatar can carry illegal, abusive or infringing
  imagery. That needs a reporting path, a review queue and an admin takedown action.
  Moderation tooling is explicitly outside the current admin scope.
- **Personal data.** A face photograph is personal data of the uploader and often of third
  parties, and it would have to be added to the record of processing, the export and the
  anonymization path. Uploaded files also carry EXIF (including GPS) unless re-encoded.
- **Hosting.** A storage bucket with per-user RLS, size and MIME validation, re-encoding
  and a cleanup path on account deletion.

None of that is hard in isolation, but it is a separate feature with a compliance surface,
not a cosmetic. The emblem catalogue delivers the actual goal — letting a manager decide
how their profile looks in the ranking — with no new personal data at all.

If uploads are wanted later, the minimum viable version is: private Supabase Storage
bucket keyed by user id, client-side canvas re-encode to a fixed square (which strips EXIF
for free), server-side MIME and size limits, an admin "clear avatar" action, and an entry
in `docs/GDPR_RECORD_OF_PROCESSING.md`.
