-- GitHub scheduled jobs can be delayed: require 30-minute freshness during live events, two hours otherwise.
create function public.is_trading_market_fresh()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(max(t.synced_at) > now() - case
    when exists(select 1 from tournaments live where live.starts_at <= now() and live.ends_at >= now())
      then interval '30 minutes'
    else interval '2 hours'
  end, false)
  from tournaments t;
$$;

create or replace function public.account_buy_player(target_player_id text, request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare player_row players; wallet_row account_wallets; trades integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not is_trading_market_fresh() then raise exception 'Market data is stale'; end if;
  select * into wallet_row from account_wallets where user_id = auth.uid() for update;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text and user_id = auth.uid()) then return; end if;
  select count(*) into trades from wallet_transactions where user_id = auth.uid()
    and type in ('trade_buy', 'trade_sell') and created_at >= date_trunc('day', now());
  if trades >= 50 then raise exception 'Daily trade limit reached'; end if;
  select * into player_row from players where id = target_player_id and active for share;
  if player_row.id is null then raise exception 'Player unavailable'; end if;
  if exists(select 1 from account_positions where user_id = auth.uid() and player_id = target_player_id) then raise exception 'Player already in portfolio'; end if;
  if wallet_row.balance < player_row.price then raise exception 'Not enough account coins'; end if;
  insert into account_positions(user_id, player_id, acquired_price) values (auth.uid(), target_player_id, player_row.price);
  update account_wallets set balance = balance - player_row.price, updated_at = now() where user_id = auth.uid()
    returning * into wallet_row;
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
  values (auth.uid(), -player_row.price, wallet_row.balance, 'trade_buy', 'player', target_player_id, request_id::text,
    jsonb_build_object('handle', player_row.handle, 'price', player_row.price));
end;
$$;

create or replace function public.account_sell_player(target_player_id text, request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare player_row players; position_row account_positions; wallet_row account_wallets; refund integer; trades integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not is_trading_market_fresh() then raise exception 'Market data is stale'; end if;
  select * into wallet_row from account_wallets where user_id = auth.uid() for update;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text and user_id = auth.uid()) then return; end if;
  select count(*) into trades from wallet_transactions where user_id = auth.uid()
    and type in ('trade_buy', 'trade_sell') and created_at >= date_trunc('day', now());
  if trades >= 50 then raise exception 'Daily trade limit reached'; end if;
  select * into position_row from account_positions where user_id = auth.uid() and player_id = target_player_id for update;
  if position_row.player_id is null then raise exception 'Player not in portfolio'; end if;
  select * into player_row from players where id = target_player_id for share;
  refund := greatest(1, floor(player_row.price * .95))::integer;
  delete from account_positions where user_id = auth.uid() and player_id = target_player_id;
  update account_wallets set balance = balance + refund, updated_at = now() where user_id = auth.uid()
    returning * into wallet_row;
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
  values (auth.uid(), refund, wallet_row.balance, 'trade_sell', 'player', target_player_id, request_id::text,
    jsonb_build_object('handle', player_row.handle, 'marketPrice', player_row.price, 'salePrice', refund,
      'acquiredPrice', position_row.acquired_price, 'realizedPnl', refund - position_row.acquired_price));
end;
$$;

revoke execute on function public.is_trading_market_fresh() from public;
