-- Account deletion must not be blocked by stakes or auction references.
alter table public.league_stakes drop constraint league_stakes_user_id_fkey;
alter table public.league_stakes add constraint league_stakes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.league_auctions drop constraint league_auctions_bidder_id_fkey;
alter table public.league_auctions add constraint league_auctions_bidder_id_fkey
  foreign key (bidder_id) references public.profiles(id) on delete cascade;

alter table public.league_auctions drop constraint league_auctions_created_by_fkey;
alter table public.league_auctions add constraint league_auctions_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;
