-- Public achievement metadata. Badges never grant roles or authorization.
create table public.badges (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 60),
  description text not null check (char_length(description) between 3 and 240),
  icon_token text not null check (icon_token ~ '^[a-z0-9-]{2,30}$'),
  is_public boolean not null default true,
  assignment_type text not null check (assignment_type in ('automatic', 'manual', 'dynamic')),
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id bigint not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles(id) on delete set null,
  reason text check (reason is null or char_length(trim(reason)) between 3 and 500),
  source text not null check (source in ('automatic', 'admin', 'verified_import')),
  primary key (user_id, badge_id)
);
create index user_badges_awarded_at on public.user_badges(awarded_at desc);

create function public.reject_dynamic_badge_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists(select 1 from public.badges where id = new.badge_id and assignment_type = 'dynamic') then
    raise invalid_parameter_value using message = 'Dynamic badges are calculated, not assigned';
  end if;
  return new;
end;
$$;
create trigger user_badges_no_dynamic_assignment
before insert or update on public.user_badges
for each row execute function public.reject_dynamic_badge_assignment();

insert into public.badges(slug, name, description, icon_token, assignment_type) values
  ('founding-50', 'Founding 50', 'One of the first 50 real FantaFort accounts.', 'founder', 'automatic'),
  ('beta-tester', 'Beta Tester', 'Helped test FantaFort during beta.', 'beta', 'automatic'),
  ('top-50', 'Top 50', 'Currently ranked among the global Top 50.', 'rank-50', 'dynamic'),
  ('top-10', 'Top 10', 'Currently ranked among the global Top 10.', 'rank-10', 'dynamic'),
  ('contributor', 'Contributor', 'Recognized for a verified contribution to FantaFort.', 'contributor', 'manual');

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
create policy "read public badge definitions" on public.badges for select using (is_public);
create policy "read own durable badges" on public.user_badges for select using (auth.uid() = user_id);

revoke all on table public.badges, public.user_badges from public, anon, authenticated;
revoke all on sequence public.badges_id_seq from public, anon, authenticated;
grant select on public.badges to anon, authenticated;
grant select on public.user_badges to authenticated;
grant all on table public.badges, public.user_badges to service_role;
grant usage, select on sequence public.badges_id_seq to service_role;
revoke all on function public.reject_dynamic_badge_assignment() from public, anon, authenticated;
grant execute on function public.reject_dynamic_badge_assignment() to service_role;

create function public.public_badges_for_user(target_user_id uuid, global_rank bigint)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', visible.slug,
    'name', visible.name,
    'description', visible.description,
    'icon', visible.icon_token
  ) order by visible.priority, visible.name), '[]'::jsonb)
  from (
    select badge.slug, badge.name, badge.description, badge.icon_token, 20 as priority
    from public.user_badges award
    join public.badges badge on badge.id = award.badge_id
    where award.user_id = target_user_id and badge.is_public and badge.assignment_type <> 'dynamic'
    union all
    select badge.slug, badge.name, badge.description, badge.icon_token,
      case badge.slug when 'top-10' then 1 else 2 end
    from public.badges badge
    where badge.is_public and badge.assignment_type = 'dynamic'
      and ((badge.slug = 'top-10' and global_rank <= 10) or (badge.slug = 'top-50' and global_rank <= 50))
  ) visible;
$$;

create or replace function public.get_global_leaderboard(search_username text default null)
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
  select rows.rank, rows.username, rows.name_style, rows.net_worth,
    public.public_badges_for_user(rows.user_id, rows.rank), rows.user_id = auth.uid()
  from public.global_leaderboard_rows() rows
  where case when query is null
    then rows.rank <= 50 or rows.user_id = auth.uid()
    else position(lower(query) in lower(rows.username)) > 0
  end
  order by rows.rank
  limit case when query is null then 51 else 20 end;
end;
$$;

create function public.admin_preview_founding_50()
returns table (
  candidate_order bigint,
  user_id uuid,
  username text,
  account_status text,
  registered_at timestamptz,
  already_awarded boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.authorize_admin_request();
  return query
  select row_number() over (order by auth_user.created_at, profile.id)::bigint,
    profile.id, profile.username, profile.account_status, auth_user.created_at,
    exists(
      select 1 from public.user_badges award
      join public.badges badge on badge.id = award.badge_id
      where award.user_id = profile.id and badge.slug = 'founding-50'
    )
  from public.profiles profile
  join auth.users auth_user on auth_user.id = profile.id
  where profile.account_status <> 'anonymized'
    and auth_user.deleted_at is null
    and nullif(auth_user.raw_user_meta_data ->> 'test_marker', '') is null
  order by auth_user.created_at, profile.id
  limit 50;
end;
$$;

revoke all on function public.public_badges_for_user(uuid,bigint) from public, anon, authenticated;
grant execute on function public.public_badges_for_user(uuid,bigint) to service_role;
revoke all on function public.admin_preview_founding_50() from public, anon, authenticated;
grant execute on function public.admin_preview_founding_50() to authenticated, service_role;

notify pgrst, 'reload schema';
