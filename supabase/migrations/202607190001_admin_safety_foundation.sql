-- Admin Control Center safety foundation. Proposed only: do not apply to hosted without approval.
alter table public.profiles
  add column account_status text not null default 'active'
  check (account_status in ('active', 'suspended', 'anonymized')),
  add column status_changed_at timestamptz not null default now();

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{2,79}$'),
  target_type text not null check (target_type ~ '^[a-z][a-z0-9_]{1,39}$'),
  target_id text not null check (char_length(target_id) between 1 and 200),
  reason text check (reason is null or char_length(trim(reason)) between 3 and 500),
  before_state jsonb not null default '{}'::jsonb check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb not null default '{}'::jsonb check (jsonb_typeof(after_state) = 'object'),
  request_id uuid not null,
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 8 and 200),
  outcome text not null check (outcome in ('succeeded', 'failed', 'denied')),
  error_code text check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  created_at timestamptz not null default now(),
  unique (actor_user_id, request_id),
  unique (actor_user_id, action, idempotency_key)
);

create index admin_audit_log_created on public.admin_audit_log(created_at desc);
create index admin_audit_log_actor_created on public.admin_audit_log(actor_user_id, created_at desc);
create index admin_audit_log_target_created on public.admin_audit_log(target_type, target_id, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;
revoke all on sequence public.admin_audit_log_id_seq from anon, authenticated;

create function public.reject_admin_audit_change()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  raise exception 'Admin audit records are append-only';
end;
$$;

create trigger admin_audit_log_no_update_or_delete
before update or delete on public.admin_audit_log
for each row execute function public.reject_admin_audit_change();

revoke all on function public.reject_admin_audit_change() from public;

create or replace function public.is_account_active()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select account_status = 'active' from profiles where id = auth.uid()), false)
$$;

revoke all on function public.is_account_active() from public;

-- Fresh projects no longer auto-grant Data API privileges. RLS still limits every authenticated row.
grant select on public.players, public.tournaments, public.player_results, public.player_price_history
  to anon, authenticated;
grant select on public.profiles, public.roster_entries, public.leagues, public.league_members,
  public.league_roster_entries, public.account_wallets, public.wallet_transactions,
  public.account_positions, public.account_watchlist, public.league_stakes, public.league_auctions,
  public.tournament_teams, public.tournament_team_members, public.tournament_sessions,
  public.competitive_rulings, public.league_strategy_picks, public.profile_xp_events,
  public.league_departures
  to authenticated;
grant insert, delete on public.account_watchlist to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Destructive self-service deletion is disabled until the reviewed anonymization flow exists.
-- Keeping the signature avoids breaking deployed clients while preventing every cascade path.
create or replace function public.delete_account(confirm_username text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if exists(select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Administrator accounts cannot be self-deleted';
  end if;
  raise exception 'Account deletion is temporarily unavailable';
end;
$$;
