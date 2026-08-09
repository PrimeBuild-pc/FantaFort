-- Add the latest market movement for held cards to the portfolio summary.
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
    'positions', coalesce(positions.items, '[]'::jsonb)
  )
  from account_wallets w
  left join lateral (
    select sum(p.price)::bigint value, sum(p.price - ap.acquired_price)::bigint pnl,
      sum(coalesce(move.change, 0))::bigint daily_pnl,
      jsonb_agg(jsonb_build_object(
        'playerId', p.id, 'handle', p.handle, 'photoUrl', p.photo_url, 'rarity', p.rarity,
        'currentPrice', p.price, 'acquiredPrice', ap.acquired_price, 'acquiredAt', ap.acquired_at,
        'pnl', p.price - ap.acquired_price, 'dailyChange', coalesce(move.change, 0)
      ) order by p.price desc) items
    from account_positions ap
    join players p on p.id = ap.player_id
    left join lateral (
      select h.new_price - h.old_price change from player_price_history h
      where h.player_id = p.id order by h.changed_at desc limit 1
    ) move on true
    where ap.user_id = w.user_id
  ) positions on true
  where w.user_id = auth.uid();
$$;
