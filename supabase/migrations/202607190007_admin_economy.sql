-- Append-only wallet ledger and atomic admin adjustments. Proposed only.
alter table public.wallet_transactions
  add column balance_before integer,
  add column reason text,
  add column external_reference text,
  add column performed_by uuid,
  add column admin_request_id uuid;

update public.wallet_transactions
set balance_before = balance_after - amount,
    reason = type
where balance_before is null or reason is null;

create function public.prepare_wallet_transaction()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if new.balance_before is null then new.balance_before := new.balance_after - new.amount; end if;
  if new.reason is null then new.reason := new.type; end if;
  return new;
end;
$$;

create trigger wallet_transactions_prepare_insert
before insert on public.wallet_transactions
for each row execute function public.prepare_wallet_transaction();

alter table public.wallet_transactions
  alter column balance_before set not null,
  alter column reason set not null,
  add constraint wallet_transactions_balance_before_check check (balance_before >= 0),
  add constraint wallet_transactions_balance_equation check (balance_after = balance_before + amount),
  add constraint wallet_transactions_reason_check check (char_length(trim(reason)) between 3 and 500),
  add constraint wallet_transactions_external_reference_check check (external_reference is null or char_length(external_reference) <= 200);

alter table public.wallet_transactions drop constraint wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check check (type in (
  'initial_grant', 'migration', 'trade_buy', 'trade_sell', 'daily_rescue',
  'gift_sent', 'gift_received', 'league_lock', 'league_refund', 'league_prize', 'league_loss',
  'admin_adjustment'
));

create function public.reject_wallet_transaction_change()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  raise exception 'Wallet transactions are append-only';
end;
$$;

create trigger wallet_transactions_no_update_or_delete
before update or delete on public.wallet_transactions
for each row execute function public.reject_wallet_transaction_change();

revoke all on function public.prepare_wallet_transaction(), public.reject_wallet_transaction_change() from public;

create function public.admin_adjust_wallet(
  target_user_id uuid,
  adjustment integer,
  expected_balance integer,
  action_reason text,
  external_reference text,
  action_request_id uuid,
  action_idempotency_key text,
  action_payload_fingerprint text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  wallet account_wallets;
  existing wallet_transactions;
  resulting_balance integer;
  normalized_reference text := nullif(trim(external_reference), '');
begin
  perform authorize_admin_request();
  if target_user_id = auth.uid() then raise invalid_parameter_value using message = 'Self balance changes are not allowed'; end if;
  if adjustment is null or adjustment = 0 or abs(adjustment::bigint) > 100000
    or expected_balance is null or expected_balance < 0
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or (normalized_reference is not null and char_length(normalized_reference) > 200)
    or action_request_id is null or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or action_payload_fingerprint is null or action_payload_fingerprint !~ '^[a-f0-9]{64}$'
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid wallet adjustment';
  end if;
  if abs(adjustment::bigint) > 10000 then
    raise program_limit_exceeded using message = 'Ordinary adjustment limit exceeded';
  end if;
  if not exists(select 1 from profiles where id = target_user_id and account_status <> 'anonymized') then
    raise invalid_parameter_value using message = 'User unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-wallet-actor:' || auth.uid()::text, 0));
  select * into existing from wallet_transactions where idempotency_key = action_idempotency_key;
  if existing.id is not null then
    if existing.user_id <> target_user_id or existing.amount <> adjustment or existing.balance_before <> expected_balance
      or existing.reason <> trim(action_reason) or existing.external_reference is distinct from normalized_reference
      or existing.performed_by is distinct from auth.uid() or existing.admin_request_id is distinct from action_request_id
      or (existing.metadata ->> 'payloadFingerprint') is distinct from action_payload_fingerprint then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('balanceBefore', existing.balance_before, 'balanceAfter', existing.balance_after, 'replayed', true);
  end if;
  if coalesce((select sum(abs(amount::bigint)) from wallet_transactions
    where type = 'admin_adjustment' and performed_by = auth.uid()
      and created_at >= date_trunc('day', now())), 0) + abs(adjustment::bigint) > 50000 then
    raise program_limit_exceeded using message = 'Daily admin adjustment limit exceeded';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-wallet:' || target_user_id::text, 0));
  select * into wallet from account_wallets where user_id = target_user_id for update;
  if wallet.user_id is null then raise no_data_found using message = 'Wallet not found'; end if;
  if wallet.balance <> expected_balance then raise serialization_failure using message = 'Wallet balance changed'; end if;
  resulting_balance := wallet.balance + adjustment;
  if resulting_balance < 0 then raise check_violation using message = 'Insufficient balance'; end if;
  perform consume_admin_step_up_grant(step_up_token_hash, 'economy');

  update account_wallets set balance = resulting_balance, updated_at = now() where user_id = target_user_id;
  insert into wallet_transactions(user_id, amount, balance_before, balance_after, type, reference_type,
    reference_id, idempotency_key, reason, external_reference, performed_by, admin_request_id, metadata)
  values (target_user_id, adjustment, wallet.balance, resulting_balance, 'admin_adjustment', 'admin',
    auth.uid()::text, action_idempotency_key, trim(action_reason), normalized_reference, auth.uid(), action_request_id,
    jsonb_build_object('payloadFingerprint', action_payload_fingerprint));
  insert into admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'economy.adjust_wallet', 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('balance', wallet.balance), jsonb_build_object('balance', resulting_balance, 'delta', adjustment),
    action_request_id, action_idempotency_key, 'succeeded');
  return jsonb_build_object('balanceBefore', wallet.balance, 'balanceAfter', resulting_balance, 'replayed', false);
end;
$$;

revoke all on function public.admin_adjust_wallet(uuid,integer,integer,text,text,uuid,text,text,text) from public;
grant execute on function public.admin_adjust_wallet(uuid,integer,integer,text,text,uuid,text,text,text) to authenticated;
