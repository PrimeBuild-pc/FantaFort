-- Serialize per-wallet limits so concurrent requests cannot bypass idempotency or daily caps.
create or replace function public.account_buy_player(target_player_id text, request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare player_row players; wallet_row account_wallets; trades integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from tournaments where synced_at > now() - interval '30 minutes') then raise exception 'Market data is stale'; end if;
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
  if not exists(select 1 from tournaments where synced_at > now() - interval '30 minutes') then raise exception 'Market data is stale'; end if;
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

create or replace function public.claim_daily_rescue(request_id uuid)
returns integer language plpgsql security definer set search_path = public
as $$
declare wallet_row account_wallets; grant_amount integer; worth bigint;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.created_at <= now() - interval '7 days' and u.email_confirmed_at is not null)
    then raise exception 'Account must be verified and 7 days old'; end if;
  select * into wallet_row from account_wallets where user_id = auth.uid() for update;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text and user_id = auth.uid()) then return 0; end if;
  if exists(select 1 from wallet_transactions where user_id = auth.uid() and type = 'daily_rescue'
    and created_at > now() - interval '24 hours') then raise exception 'Recovery already claimed'; end if;
  worth := account_net_worth(auth.uid());
  if wallet_row.balance >= 500 or worth >= 1500 then raise exception 'Recovery is only available below the safety threshold'; end if;
  grant_amount := least(100, 500 - wallet_row.balance);
  update account_wallets set balance = balance + grant_amount, updated_at = now() where user_id = auth.uid()
    returning * into wallet_row;
  insert into wallet_transactions(user_id, amount, balance_after, type, idempotency_key)
  values (auth.uid(), grant_amount, wallet_row.balance, 'daily_rescue', request_id::text);
  return grant_amount;
end;
$$;

create or replace function public.gift_coins(friend_id uuid, amount integer, request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare sender account_wallets; receiver account_wallets; sent_today integer;
begin
  if auth.uid() is null or friend_id = auth.uid() then raise exception 'Invalid recipient'; end if;
  if amount not between 10 and 300 then raise exception 'Gift must be 10-300 coins'; end if;
  if not exists(select 1 from profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.created_at <= now() - interval '7 days' and u.email_confirmed_at is not null)
    then raise exception 'Account must be verified and 7 days old'; end if;
  if not exists(select 1 from friendships where user_a = least(auth.uid(), friend_id)
    and user_b = greatest(auth.uid(), friend_id) and status = 'accepted') then raise exception 'Accepted friend required'; end if;
  perform 1 from account_wallets where user_id in (auth.uid(), friend_id) order by user_id for update;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text || ':sent' and user_id = auth.uid()) then return; end if;
  select coalesce(-sum(t.amount), 0) into sent_today from wallet_transactions t
    where t.user_id = auth.uid() and t.type = 'gift_sent' and t.created_at >= date_trunc('day', now());
  if sent_today + amount > 300 then raise exception 'Daily gift limit exceeded'; end if;
  select * into sender from account_wallets where user_id = auth.uid();
  select * into receiver from account_wallets where user_id = friend_id;
  if sender.balance - amount < 100 then raise exception 'Keep at least 100 coins'; end if;
  update account_wallets set balance = balance - amount, updated_at = now() where user_id = auth.uid() returning * into sender;
  update account_wallets set balance = balance + amount, updated_at = now() where user_id = friend_id returning * into receiver;
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key)
  values
    (auth.uid(), -amount, sender.balance, 'gift_sent', 'user', friend_id::text, request_id::text || ':sent'),
    (friend_id, amount, receiver.balance, 'gift_received', 'user', auth.uid()::text, request_id::text || ':received');
end;
$$;
