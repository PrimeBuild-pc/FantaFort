# Admin session compatibility

## Documented Auth APIs first

FantaFort uses documented Supabase Auth methods whenever they are equivalent:

- `auth.admin.updateUserById(userId, { ban_duration })` for suspension/reactivation;
- `auth.resetPasswordForEmail(email, { redirectTo })` to send recovery mail without generating or exposing a link;
- `auth.admin.signOut(jwt, scope)` when the target access token is available.

References:

- https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-admin-signout
- https://supabase.com/docs/guides/auth/sessions

## Why `auth.sessions` remains

Supabase documents that each JWT `session_id` maps to `auth.sessions.id`, but the Admin API has no documented revoke-all-by-user-ID operation. `auth.admin.signOut` requires the target JWT, which the admin service deliberately does not store.

Migration `202607190005` therefore uses `auth.sessions` only inside reviewed `security definer` database functions to:

1. delete all sessions for a target user ID;
2. reject Data API requests immediately when the JWT session row no longer exists.

The Auth schema is never exposed to the browser or queried by client code. Suspension still uses the documented Admin API.

## Compatibility and fail-closed behavior

This integration assumes `auth.sessions.id`, `auth.sessions.user_id`, and the JWT `session_id` claim described by Supabase's session guide. A Supabase upgrade that removes or changes these fields must make migration validation or the pre-request check fail; the revoke route must remain disabled until revalidated.

Fallback:

- if a target JWT is explicitly available, use documented `auth.admin.signOut(jwt, 'global')`;
- otherwise there is no equivalent documented revoke-all-by-user-ID API, so disable manual revocation and rely on ban plus normal JWT expiry rather than weakening the database guard.

Revalidate this migration against staging after every Supabase Auth major upgrade. Never grant browser access to the Auth schema.
