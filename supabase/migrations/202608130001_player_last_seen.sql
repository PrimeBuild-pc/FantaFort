-- Pool membership must decay on time, not on absence from a single crawl.
--
-- `sync-player-pool.mjs` deactivated every active player without a photo that was
-- missing from the current import. Running incrementally every 15 minutes over ~6
-- leaderboard windows, that removed everyone it had not just seen: production held
-- 1,036 active of 5,264 players, and all 4,228 deactivated rows were exactly the
-- photo-less ones. `last_seen_at` replaces "was in this run" with "last competed".

alter table public.players add column if not exists last_seen_at timestamptz;

-- Backfill from real competitive history where we have it; players with no recorded
-- result (seeded and curated entries) start their grace period now rather than being
-- assigned a date we cannot evidence.
update public.players p
set last_seen_at = coalesce(
  (
    select max(t.ends_at)
    from public.player_results r
    join public.tournaments t on t.window_id = r.window_id
    where r.player_id = p.id
  ),
  now()
)
where p.last_seen_at is null;

alter table public.players alter column last_seen_at set default now();
alter table public.players alter column last_seen_at set not null;

-- Supports the set-based decay sweep in the pool import.
create index if not exists players_active_last_seen_idx
  on public.players (last_seen_at)
  where active;

comment on column public.players.last_seen_at is
  'Last time the account appeared in an imported leaderboard, or the backfill date. Drives pool decay; see src/lib/pro-eligibility.ts.';
