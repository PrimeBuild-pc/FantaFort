-- Joining a staked league requires a visible summary before funds are locked.
create function public.preview_league_invite(code text)
returns table(name text, members bigint, economy_mode text, entry_stake integer, initial_budget integer, roster_size integer, draft_mode text, duration_days integer)
language sql stable security definer set search_path = public
as $$
  select l.name, count(m.user_id), l.economy_mode, l.entry_stake, l.initial_budget,
    l.roster_size, l.draft_mode, l.duration_days
  from leagues l left join league_members m on m.league_id = l.id
  where l.invite_code = upper(trim(code)) and l.status = 'lobby'
  group by l.id;
$$;

revoke execute on function public.preview_league_invite(text) from public;
grant execute on function public.preview_league_invite(text) to authenticated;
