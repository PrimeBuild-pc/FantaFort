-- Explain recovery eligibility correctly and prioritize actual wealth over account age.
create or replace function public.get_account_portfolio()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'balance', w.balance,
    'lockedBalance', w.locked_balance,
    'holdingsValue', coalesce(positions.value, 0),
    'totalEquity', w.balance + w.locked_balance + coalesce(positions.value, 0),
    'unrealizedPnl', coalesce(positions.pnl, 0),
    'dailyPnl', coalesce(positions.daily_pnl, 0),
    'rescueAvailable', w.balance < 500
      and w.balance + w.locked_balance + coalesce(positions.value, 0) < 1500
      and p.created_at <= now() - interval '7 days'
      and u.email_confirmed_at is not null
      and (rescue.last_claimed_at is null or rescue.last_claimed_at <= now() - interval '24 hours'),
    'rescueReason', case
      when w.balance >= 500 or w.balance + w.locked_balance + coalesce(positions.value, 0) >= 1500 then 'wealth'
      when p.created_at > now() - interval '7 days' or u.email_confirmed_at is null then 'account_age'
      when rescue.last_claimed_at > now() - interval '24 hours' then 'cooldown'
      else 'available'
    end,
    'nextRescueAt', case when rescue.last_claimed_at > now() - interval '24 hours'
      then rescue.last_claimed_at + interval '24 hours' else null end,
    'positions', coalesce(positions.items, '[]'::jsonb)
  )
  from account_wallets w
  join profiles p on p.id = w.user_id
  join auth.users u on u.id = w.user_id
  left join lateral (
    select sum(player.price)::bigint value, sum(player.price - ap.acquired_price)::bigint pnl,
      sum(coalesce(move.change, 0))::bigint daily_pnl,
      jsonb_agg(jsonb_build_object(
        'playerId', player.id, 'handle', player.handle, 'photoUrl', player.photo_url, 'rarity', player.rarity,
        'currentPrice', player.price, 'acquiredPrice', ap.acquired_price, 'acquiredAt', ap.acquired_at,
        'pnl', player.price - ap.acquired_price, 'dailyChange', coalesce(move.change, 0)
      ) order by player.price desc) items
    from account_positions ap
    join players player on player.id = ap.player_id
    left join lateral (
      select h.new_price - h.old_price change from player_price_history h
      where h.player_id = player.id order by h.changed_at desc limit 1
    ) move on true
    where ap.user_id = w.user_id
  ) positions on true
  left join lateral (
    select max(t.created_at) last_claimed_at from wallet_transactions t
    where t.user_id = w.user_id and t.type = 'daily_rescue'
  ) rescue on true
  where w.user_id = auth.uid();
$$;

create or replace function public.claim_daily_rescue(request_id uuid)
returns integer language plpgsql security definer set search_path = public
as $$
declare wallet_row account_wallets; grant_amount integer; worth bigint;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into wallet_row from account_wallets where user_id = auth.uid() for update;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text and user_id = auth.uid()) then return 0; end if;
  worth := account_net_worth(auth.uid());
  if wallet_row.balance >= 500 or worth >= 1500 then
    raise exception 'Recovery requires less than 500 available coins and less than 1,500 total equity';
  end if;
  if not exists(select 1 from profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.created_at <= now() - interval '7 days' and u.email_confirmed_at is not null)
    then raise exception 'Account must be verified and 7 days old'; end if;
  if exists(select 1 from wallet_transactions where user_id = auth.uid() and type = 'daily_rescue'
    and created_at > now() - interval '24 hours') then raise exception 'Recovery already claimed'; end if;
  grant_amount := least(100, 500 - wallet_row.balance);
  update account_wallets set balance = balance + grant_amount, updated_at = now() where user_id = auth.uid()
    returning * into wallet_row;
  insert into wallet_transactions(user_id, amount, balance_after, type, idempotency_key)
  values (auth.uid(), grant_amount, wallet_row.balance, 'daily_rescue', request_id::text);
  return grant_amount;
end;
$$;
