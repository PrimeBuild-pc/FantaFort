-- Accurate 24-hour and realized P&L for the financial-style trading dashboard.
create or replace function public.get_account_portfolio()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'balance', w.balance,
    'lockedBalance', w.locked_balance,
    'holdingsValue', coalesce(positions.value, 0),
    'totalEquity', w.balance + w.locked_balance + coalesce(positions.value, 0),
    'unrealizedPnl', coalesce(positions.pnl, 0),
    'realizedPnl', coalesce(realized.pnl, 0),
    'totalPnl', coalesce(positions.pnl, 0) + coalesce(realized.pnl, 0),
    'dailyPnl', coalesce(positions.daily_pnl, 0),
    'rescueAvailable', w.balance < 500
      and w.balance + w.locked_balance + coalesce(positions.value, 0) < 1500
      and profile.created_at <= now() - interval '7 days'
      and auth_user.email_confirmed_at is not null
      and (rescue.last_claimed_at is null or rescue.last_claimed_at <= now() - interval '24 hours'),
    'rescueReason', case
      when w.balance >= 500 or w.balance + w.locked_balance + coalesce(positions.value, 0) >= 1500 then 'wealth'
      when profile.created_at > now() - interval '7 days' or auth_user.email_confirmed_at is null then 'account_age'
      when rescue.last_claimed_at > now() - interval '24 hours' then 'cooldown'
      else 'available'
    end,
    'nextRescueAt', case when rescue.last_claimed_at > now() - interval '24 hours'
      then rescue.last_claimed_at + interval '24 hours' else null end,
    'positions', coalesce(positions.items, '[]'::jsonb)
  )
  from account_wallets w
  join profiles profile on profile.id = w.user_id
  join auth.users auth_user on auth_user.id = w.user_id
  left join lateral (
    select sum(player.price)::bigint value,
      sum(player.price - ap.acquired_price)::bigint pnl,
      sum(player.price - baseline.price)::bigint daily_pnl,
      jsonb_agg(jsonb_build_object(
        'playerId', player.id, 'handle', player.handle, 'photoUrl', player.photo_url, 'rarity', player.rarity,
        'currentPrice', player.price, 'acquiredPrice', ap.acquired_price, 'acquiredAt', ap.acquired_at,
        'pnl', player.price - ap.acquired_price, 'dailyChange', player.price - baseline.price
      ) order by player.price desc) items
    from account_positions ap
    join players player on player.id = ap.player_id
    left join lateral (
      select coalesce(
        (select h.new_price from player_price_history h
          where h.player_id = player.id and h.changed_at <= now() - interval '24 hours'
          order by h.changed_at desc limit 1),
        (select h.old_price from player_price_history h
          where h.player_id = player.id order by h.changed_at asc limit 1),
        player.price
      )::integer price
    ) baseline on true
    where ap.user_id = w.user_id
  ) positions on true
  left join lateral (
    select coalesce(sum((t.metadata ->> 'realizedPnl')::integer), 0)::bigint pnl
    from wallet_transactions t where t.user_id = w.user_id and t.type = 'trade_sell'
  ) realized on true
  left join lateral (
    select max(t.created_at) last_claimed_at from wallet_transactions t
    where t.user_id = w.user_id and t.type = 'daily_rescue'
  ) rescue on true
  where w.user_id = auth.uid();
$$;
