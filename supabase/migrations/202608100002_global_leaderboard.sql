-- Minimal public net-worth ranking. Wallets, holdings, Auth data and internal IDs stay private.
create function public.global_leaderboard_rows()
returns table (
  user_id uuid,
  username text,
  name_style text,
  created_at timestamptz,
  net_worth bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with eligible as (
    select p.id as user_id, p.username, p.name_style, p.created_at,
      (w.balance::bigint + w.locked_balance::bigint + coalesce(sum(player.price), 0)::bigint) as net_worth
    from public.profiles p
    join public.account_wallets w on w.user_id = p.id
    join auth.users auth_user on auth_user.id = p.id
    left join public.account_positions position on position.user_id = p.id
    left join public.players player on player.id = position.player_id
    where p.account_status = 'active'
      and auth_user.deleted_at is null
      and (auth_user.banned_until is null or auth_user.banned_until <= now())
      and nullif(auth_user.raw_user_meta_data ->> 'test_marker', '') is null
    group by p.id, p.username, p.name_style, p.created_at, w.balance, w.locked_balance
  )
  select eligible.user_id, eligible.username, eligible.name_style, eligible.created_at, eligible.net_worth,
    row_number() over (order by eligible.net_worth desc, eligible.created_at, eligible.user_id)::bigint as rank
  from eligible;
$$;

create function public.get_global_leaderboard(search_username text default null)
returns table (
  rank bigint,
  username text,
  name_style text,
  net_worth bigint,
  badges jsonb,
  is_current_user boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare query text := nullif(trim(search_username), '');
begin
  if query is not null and (char_length(query) > 30 or query !~ '^[A-Za-z0-9_.-]+$') then
    raise invalid_parameter_value using message = 'Invalid nickname search';
  end if;

  return query
  select rows.rank, rows.username, rows.name_style, rows.net_worth, '[]'::jsonb,
    rows.user_id = auth.uid()
  from public.global_leaderboard_rows() rows
  where case when query is null
    then rows.rank <= 50 or rows.user_id = auth.uid()
    else position(lower(query) in lower(rows.username)) > 0
  end
  order by rows.rank
  limit case when query is null then 51 else 20 end;
end;
$$;

revoke all on function public.global_leaderboard_rows() from public, anon, authenticated;
grant execute on function public.global_leaderboard_rows() to service_role;
revoke all on function public.get_global_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_global_leaderboard(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
