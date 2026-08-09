-- Keep leagues created before strategic settings usable after the upgrade.
update public.leagues
set market_closes_at = coalesce(market_closes_at, now() + interval '24 hours'),
    ends_at = coalesce(ends_at, now() + interval '30 days')
where status = 'active';
