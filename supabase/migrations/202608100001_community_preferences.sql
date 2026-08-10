-- Explicit, revocable product/community update consent. No email is sent by this migration.
alter table public.profiles
  add column community_email_opt_in boolean not null default false,
  add column community_email_opted_in_at timestamptz,
  add column community_email_opted_out_at timestamptz,
  add column community_email_consent_version text,
  add column community_email_consent_source text,
  add constraint profiles_community_email_consent_check check (
    not community_email_opt_in or (
      community_email_opted_in_at is not null
      and community_email_opted_out_at is null
      and char_length(community_email_consent_version) between 3 and 40
      and community_email_consent_source in ('account_settings', 'beta_notice')
    )
  );

create function public.update_communication_preferences(
  enabled boolean,
  consent_version text,
  consent_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare current_opt_in boolean;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Sign in required'; end if;
  if consent_version !~ '^[a-z0-9._-]{3,40}$'
    or consent_source not in ('account_settings', 'beta_notice') then
    raise invalid_parameter_value using message = 'Invalid communication preference';
  end if;

  select community_email_opt_in into current_opt_in
  from public.profiles where id = auth.uid() for update;
  if not found then raise no_data_found using message = 'Profile not found'; end if;

  if enabled and not current_opt_in then
    update public.profiles set
      community_email_opt_in = true,
      community_email_opted_in_at = now(),
      community_email_opted_out_at = null,
      community_email_consent_version = consent_version,
      community_email_consent_source = consent_source
    where id = auth.uid();
  elsif not enabled and current_opt_in then
    update public.profiles set
      community_email_opt_in = false,
      community_email_opted_out_at = now()
    where id = auth.uid();
  end if;

  return (
    select jsonb_build_object(
      'enabled', community_email_opt_in,
      'optedInAt', community_email_opted_in_at,
      'optedOutAt', community_email_opted_out_at,
      'consentVersion', community_email_consent_version,
      'consentSource', community_email_consent_source
    )
    from public.profiles where id = auth.uid()
  );
end;
$$;

revoke all on function public.update_communication_preferences(boolean,text,text) from public, anon, authenticated;
grant execute on function public.update_communication_preferences(boolean,text,text) to authenticated;
grant execute on function public.update_communication_preferences(boolean,text,text) to service_role;

notify pgrst, 'reload schema';
