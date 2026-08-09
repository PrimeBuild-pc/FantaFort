create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 30),
  coins integer not null default 10000 check (coins >= 0),
  created_at timestamptz not null default now()
);

create table public.players (
  id text primary key,
  account_id text unique,
  handle text not null,
  real_name text,
  organization text,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  price integer not null check (price > 0),
  active boolean not null default true
);

create table public.roster_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id text not null references public.players(id),
  acquired_price integer not null check (acquired_price > 0),
  acquired_at timestamptz not null default now(),
  released_at timestamptz
);

create unique index one_active_player_per_roster
  on public.roster_entries (user_id, player_id)
  where released_at is null;

create table public.tournaments (
  window_id text primary key,
  event_id text not null,
  name text not null,
  region text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  synced_at timestamptz not null default now()
);

create table public.player_results (
  window_id text not null references public.tournaments(window_id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  rank integer not null check (rank > 0),
  points integer not null default 0,
  matches integer not null default 0,
  wins integer not null default 0,
  team_eliminations integer not null default 0,
  primary key (window_id, player_id)
);

insert into public.players (id, account_id, handle, real_name, organization, rarity, price) values
  ('peterbot', '45ce4565b6db452c9419119b12e7eac3', 'Peterbot', 'Peter Kata', 'Falcons', 'legendary', 4500),
  ('pollo', '9868429b133a42b8a43f737887da4673', 'Pollo', 'Miguel Moreno', 'Falcons', 'legendary', 4300),
  ('cold', 'f0102e00774b4b33b5cdfe092ec8d786', 'Cold', 'Joshua Butler', 'Agent', 'epic', 3800),
  ('thomas', 'daff9a4a3b0142e5ae58077a3ee1b4cc', 'Th0masHD', 'Thomas Davidsen', 'Virtus.pro', 'epic', 3500),
  ('veno', '5b9f90e50d3644319676cfcc51e458bf', 'Veno', 'Harry Pearson', 'XSET', 'epic', 3600),
  ('mongraal', '3c65e61b2cca4c6fa87e87afea1c5ad5', 'Mongraal', 'Kyle Jackson', 'Free Agent', 'rare', 2500),
  ('clix', '3736de3c0eb043649fac15ec1025ff08', 'Clix', 'Cody Conrod', 'XSET', 'epic', 3200),
  ('bugha', '827abb1cd9fb4618991425c2d3ba9b76', 'Bugha', 'Kyle Giersdorf', 'Dignitas', 'legendary', 4000);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), 23)
      || '_' || left(new.id::text, 6)
  );
  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.buy_player(target_player_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  player_price integer;
  current_coins integer;
begin
  select price into player_price from players where id = target_player_id and active;
  if player_price is null then raise exception 'Giocatore non disponibile'; end if;

  select coins into current_coins from profiles where id = auth.uid() for update;
  if current_coins is null then raise exception 'Utente non autenticato'; end if;
  if current_coins < player_price then raise exception 'Crediti insufficienti'; end if;
  if (select count(*) from roster_entries where user_id = auth.uid() and released_at is null) >= 3 then
    raise exception 'La rosa è completa (3 giocatori)';
  end if;
  if exists (select 1 from roster_entries where user_id = auth.uid() and player_id = target_player_id and released_at is null) then
    raise exception 'Giocatore già in rosa';
  end if;

  insert into roster_entries (user_id, player_id, acquired_price)
  values (auth.uid(), target_player_id, player_price);
  update profiles set coins = coins - player_price where id = auth.uid();
end;
$$;

create or replace function public.sell_player(target_player_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  entry_id bigint;
  refund integer;
begin
  select id, acquired_price into entry_id, refund
  from roster_entries
  where user_id = auth.uid() and player_id = target_player_id and released_at is null
  order by acquired_at desc limit 1 for update;

  if entry_id is null then raise exception 'Giocatore non presente in rosa'; end if;
  -- ponytail: rimborso pieno nell'MVP; aggiungere spread solo con un mercato dinamico.
  update roster_entries set released_at = now() where id = entry_id;
  update profiles set coins = coins + refund where id = auth.uid();
end;
$$;

create or replace function public.get_fantasy_leaderboard()
returns table (username text, points bigint)
language sql
security definer set search_path = public
as $$
  select p.username, coalesce(sum(case when tournament.window_id is not null then result.points else 0 end), 0)::bigint
  from profiles p
  left join roster_entries roster on roster.user_id = p.id
  left join player_results result on result.player_id = roster.player_id
  left join tournaments tournament on tournament.window_id = result.window_id
    and tournament.starts_at >= roster.acquired_at
    and (roster.released_at is null or tournament.starts_at < roster.released_at)
  group by p.id, p.username
  order by 2 desc, p.username;
$$;

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.roster_entries enable row level security;
alter table public.tournaments enable row level security;
alter table public.player_results enable row level security;

create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "read players" on public.players for select using (true);
create policy "read own roster" on public.roster_entries for select using (auth.uid() = user_id);
create policy "read tournaments" on public.tournaments for select using (true);
create policy "read results" on public.player_results for select using (true);

revoke execute on function public.buy_player(text) from public;
revoke execute on function public.sell_player(text) from public;
revoke execute on function public.get_fantasy_leaderboard() from public;
grant execute on function public.buy_player(text) to authenticated;
grant execute on function public.sell_player(text) to authenticated;
grant execute on function public.get_fantasy_leaderboard() to authenticated;
