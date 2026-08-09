# FantaFort Supabase email templates

Drafts only. Do not apply directly to production. All templates use Supabase `{{ .ConfirmationURL }}`, table layout, inline styles and no required images or external fonts.

## Subjects

- `confirmation.html`: production `Confirm your FantaFort account`; staging `[STAGING] Confirm your FantaFort account`
- `recovery.html`: production `Reset your FantaFort password`; staging `[STAGING] Reset your FantaFort password`
- `magic_link.html`: production `Your FantaFort sign-in link`; staging `[STAGING] Your FantaFort sign-in link`
- `email_change.html`: production `Confirm your new FantaFort email`; staging `[STAGING] Confirm your new FantaFort email`
- `invite.html`: production `You're invited to FantaFort`; staging `[STAGING] You're invited to FantaFort`

## Safe rollout

1. Paste the five files from `staging/` into the corresponding FantaFort Staging Auth email templates.
2. Send each flow to a fresh test account and verify the CTA and visible fallback URL stay on `fantafort-staging.vercel.app`.
3. Check Gmail, Outlook and Apple Mail, including images-disabled mode (these drafts intentionally need no image).
4. Only after approval, paste the matching files from `production/`.

## Asset decision

No suitable official static logo or email banner exists in `public/`. The current FantaFort wordmark is text/CSS, while `/opengraph-image` is a large generated social image and is not appropriate as a lightweight email logo. These drafts therefore render a resilient text wordmark. If an approved logo is supplied later, publish an optimized file at `public/email/fantafort-wordmark.png` (suggested 360×80, under 30 KB) and use `https://fantafort.com/email/fantafort-wordmark.png` with defined dimensions and alt text.
