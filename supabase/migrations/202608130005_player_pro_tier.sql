-- Why a player is in the market, recorded alongside the free-text reason.
--
-- The pool now recruits from Division 1-3 FNCS plus open cups across five regions,
-- with a deliberately deeper cutoff for the home audience. Without a tier the
-- selection rule is only readable in the eligibility note, which is prose and cannot
-- be filtered or capped on.
alter table public.players add column if not exists pro_tier text
  check (pro_tier is null or pro_tier in ('elite', 'contender', 'regional', 'open'));

comment on column public.players.pro_tier is
  'Strongest qualifying claim from the last import; see src/lib/pro-eligibility.ts. Null for seeded and curated entries.';

create index if not exists players_active_tier_idx on public.players (pro_tier) where active;
