-- Database-side kill switch for every admin mutation grant. Disabled by default.
create table public.admin_runtime_config (
  singleton boolean primary key default true check (singleton),
  mutations_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.admin_runtime_config(singleton, mutations_enabled) values (true, false);
alter table public.admin_runtime_config enable row level security;
revoke all on table public.admin_runtime_config from public, anon, authenticated;
grant select, update on table public.admin_runtime_config to service_role;

create function public.enforce_admin_mutation_runtime()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce((select mutations_enabled from public.admin_runtime_config where singleton), false) then
    raise insufficient_privilege using message = 'Admin mutations disabled';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_admin_mutation_runtime() from public;

delete from public.admin_step_up_grants;
create trigger admin_step_up_grants_runtime_guard
before insert on public.admin_step_up_grants
for each row execute function public.enforce_admin_mutation_runtime();
