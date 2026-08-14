-- Article 21 GDPR objections from professional players, who are not registered users.
-- The pool sync upserts `active: true` for every account it crawls, so removing a
-- player by hand is undone on the next run. The importer reads this list instead.
create table public.player_data_objections (
  account_id text primary key,
  handle text,
  received_at timestamptz not null default now(),
  note text
);

alter table public.player_data_objections enable row level security;
revoke all on table public.player_data_objections from anon, authenticated;
grant all on table public.player_data_objections to service_role;

-- Objection takes effect immediately, not at the next crawl. Historical rows keep the
-- opaque Epic account id so rosters and results stay referentially intact.
-- ponytail: deactivation only; full erasure of past result rows stays an admin-reviewed
-- action because player_results and rosters reference the player.
create function public.apply_player_data_objection()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.players set active = false where account_id = new.account_id;
  return new;
end;
$$;

create trigger player_data_objections_apply
after insert on public.player_data_objections
for each row execute function public.apply_player_data_objection();

revoke all on function public.apply_player_data_objection() from public;
