-- New private-league invites use 64-bit identifiers; existing 8-character codes remain valid.
create or replace function public.create_league(
  league_name text, budget integer, slots integer, market_hours integer, league_days integer,
  mode text, economy text, stake integer, draft text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid; code text;
begin
  league_name := trim(league_name);
  if char_length(league_name) not between 3 and 40 then raise exception 'League name must be 3-40 characters'; end if;
  if budget not between 6000 and 30000 then raise exception 'Budget must be 6,000-30,000'; end if;
  if slots not between 2 and 4 then raise exception 'Roster must have 2-4 players'; end if;
  if market_hours not between 1 and 168 then raise exception 'Market duration must be 1-168 hours'; end if;
  if league_days not between 1 and 365 then raise exception 'League duration must be 1-365 days'; end if;
  if mode not in ('classic', 'balanced', 'formation') then raise exception 'Invalid scoring mode'; end if;
  if economy not in ('demo', 'account_stake') then raise exception 'Invalid economy mode'; end if;
  if draft not in ('market', 'auction') then raise exception 'Invalid draft mode'; end if;
  if (economy = 'demo' and stake <> 0) or (economy = 'account_stake' and stake not in (500, 1000, 2000)) then raise exception 'Invalid entry stake'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  insert into leagues(name, owner_id, invite_code, initial_budget, roster_size, draft_hours, duration_days,
    scoring_mode, economy_mode, entry_stake, draft_mode)
  values (league_name, auth.uid(), code, budget, slots, market_hours, league_days, mode, economy, stake, draft)
  returning id into new_id;
  insert into league_members(league_id, user_id, role, coins) values (new_id, auth.uid(), 'owner', budget);
  perform lock_league_stake_for_user(new_id, auth.uid());
  return new_id;
end;
$$;

create or replace function public.join_league(code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target leagues; member_count integer;
begin
  code := upper(trim(code));
  if code !~ '^[A-F0-9]{8,16}$' then raise invalid_parameter_value using message = 'Invalid invite code'; end if;
  select * into target from leagues where invite_code = code for update;
  if target.id is null then raise exception 'Invite code not found'; end if;
  if target.status <> 'lobby' then raise exception 'League already started'; end if;
  if exists(select 1 from league_members where league_id = target.id and user_id = auth.uid()) then return target.id; end if;
  select count(*) into member_count from league_members where league_id = target.id;
  if member_count >= target.max_members then raise exception 'League is full'; end if;
  insert into league_members(league_id, user_id, coins) values (target.id, auth.uid(), target.initial_budget);
  perform lock_league_stake_for_user(target.id, auth.uid());
  return target.id;
end;
$$;

create or replace function public.preview_league_invite(code text)
returns table(name text, members bigint, economy_mode text, entry_stake integer, initial_budget integer, roster_size integer, draft_mode text, duration_days integer)
language sql stable security definer set search_path = public
as $$
  select l.name, count(m.user_id), l.economy_mode, l.entry_stake, l.initial_budget,
    l.roster_size, l.draft_mode, l.duration_days
  from leagues l left join league_members m on m.league_id = l.id
  where upper(trim(code)) ~ '^[A-F0-9]{8,16}$'
    and l.invite_code = upper(trim(code)) and l.status = 'lobby'
  group by l.id;
$$;
