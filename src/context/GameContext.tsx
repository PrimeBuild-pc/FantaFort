/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { AccountPortfolio, League, LeagueSettings, Player, Profile } from '@/lib/types';
import { COMMUNICATION_CONSENT_VERSION } from '@/lib/community';
import { fetchPlayersByIds } from '@/lib/market-players';
import { supabase } from '@/lib/supabase';
import { useLocale } from './LocaleContext';

interface GameState {
  coins: number;
  team: Player[];
  leagues: League[];
  activeLeagueId: string | null;
  profile: Profile | null;
  accountPortfolio: AccountPortfolio;
  loading: boolean;
  userEmail: string | null;
  userId: string | null;
  addToTeam: (player: Player) => Promise<string | null>;
  removeFromTeam: (playerId: string) => Promise<string | null>;
  selectLeague: (leagueId: string) => Promise<void>;
  createLeague: (name: string, settings: LeagueSettings) => Promise<string | null>;
  joinLeague: (code: string) => Promise<string | null>;
  startLeague: (leagueId: string) => Promise<string | null>;
  finishLeague: (leagueId: string) => Promise<string | null>;
  leaveLeague: (leagueId: string) => Promise<string | null>;
  cancelLeague: (leagueId: string) => Promise<string | null>;
  accountBuyPlayer: (playerId: string) => Promise<string | null>;
  accountSellPlayer: (playerId: string) => Promise<string | null>;
  saveProfile: (username: string, locale: string) => Promise<string | null>;
  saveCommunicationPreference: (enabled: boolean) => Promise<string | null>;
  savePublicLineupVisibility: (enabled: boolean) => Promise<string | null>;
  buyCosmetic: (slug: string) => Promise<string | null>;
  equipCosmetic: (kind: string, slug: string) => Promise<string | null>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const GameContext = createContext<GameState | undefined>(undefined);
const MAX_ROSTER = 3;
const EMPTY_PORTFOLIO: AccountPortfolio = { balance: 0, lockedBalance: 0, holdingsValue: 0, totalEquity: 0, unrealizedPnl: 0, realizedPnl: 0, totalPnl: 0, dailyPnl: 0, rescueAvailable: false, rescueReason: 'account_age', positions: [] };

export function GameProvider({ children }: { children: ReactNode }) {
  const { setLocale } = useLocale();
  const [coins, setCoins] = useState(10000);
  const [team, setTeam] = useState<Player[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accountPortfolio, setAccountPortfolio] = useState<AccountPortfolio>(EMPTY_PORTFOLIO);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadCloudGame = useCallback(async (id: string, preferredLeague?: string | null) => {
    if (!supabase) return;
    const [profileResult, membershipsResult, portfolioResult] = await Promise.all([
      supabase.from('profiles').select('username,locale,reward_points,experience_points,is_admin,name_style,avatar_style,community_email_opt_in,community_email_opted_in_at,community_email_opted_out_at,public_lineup_enabled').eq('id', id).single(),
      supabase.from('league_members').select('league_id,coins,reserved_coins').eq('user_id', id),
      supabase.rpc('get_account_portfolio'),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (membershipsResult.error) throw membershipsResult.error;
    if (portfolioResult.error) throw portfolioResult.error;

    const portfolio = (portfolioResult.data || EMPTY_PORTFOLIO) as AccountPortfolio;
    const leagueIds = membershipsResult.data.map(row => row.league_id);
    let leagueList: League[] = [];
    if (leagueIds.length) {
      const [leagueResult, memberResult] = await Promise.all([
        supabase.from('leagues').select('id,name,invite_code,status,owner_id,initial_budget,roster_size,draft_hours,duration_days,scoring_mode,economy_mode,entry_stake,draft_mode,starts_at,ends_at,market_closes_at').in('id', leagueIds),
        supabase.from('league_members').select('league_id').in('league_id', leagueIds),
      ]);
      if (leagueResult.error) throw leagueResult.error;
      const counts = new Map<string, number>();
      memberResult.data?.forEach(row => counts.set(row.league_id, (counts.get(row.league_id) || 0) + 1));
      leagueList = leagueResult.data.map(row => ({
        id: row.id, name: row.name, inviteCode: row.invite_code, status: row.status,
        ownerId: row.owner_id, members: counts.get(row.id) || 1,
        budget: row.initial_budget, rosterSize: row.roster_size, marketHours: row.draft_hours,
        durationDays: row.duration_days, scoringMode: row.scoring_mode,
        economyMode: row.economy_mode, entryStake: row.entry_stake, draftMode: row.draft_mode,
        startsAt: row.starts_at, endsAt: row.ends_at, marketClosesAt: row.market_closes_at,
      }));
    }

    const requested = preferredLeague || localStorage.getItem('fantafort-league');
    const selected = leagueList.find(league => league.id === requested)?.id || leagueList[0]?.id || null;
    let rosterIds: string[] = [];
    let currentCoins = portfolio.balance;
    if (selected) {
      const roster = await supabase.from('league_roster_entries').select('player_id').eq('league_id', selected).eq('user_id', id).is('released_at', null);
      if (roster.error) throw roster.error;
      rosterIds = roster.data.map(row => row.player_id);
      const membership = membershipsResult.data.find(row => row.league_id === selected);
      currentCoins = membership ? membership.coins - membership.reserved_coins : 10000;
      localStorage.setItem('fantafort-league', selected);
    } else {
      rosterIds = portfolio.positions.map(position => position.playerId);
    }

    const nextProfile: Profile = {
      username: profileResult.data.username, locale: profileResult.data.locale,
      rewardPoints: profileResult.data.reward_points, experiencePoints: profileResult.data.experience_points,
      isAdmin: profileResult.data.is_admin, nameStyle: profileResult.data.name_style, avatarStyle: profileResult.data.avatar_style,
      communityEmailOptIn:profileResult.data.community_email_opt_in,
      communityEmailOptedInAt:profileResult.data.community_email_opted_in_at,
      communityEmailOptedOutAt:profileResult.data.community_email_opted_out_at,
      publicLineupEnabled:profileResult.data.public_lineup_enabled,
    };
    // Resolve only the roster, never the whole market: this line used to force the
    // entire player pool to exist in the browser on every page, admin included.
    setTeam(rosterIds.length ? await fetchPlayersByIds(supabase, rosterIds) : []);
    setLeagues(leagueList);
    setActiveLeagueId(selected);
    setCoins(currentCoins);
    setProfile(nextProfile);
    setAccountPortfolio(portfolio);
    if (!localStorage.getItem('fantafort-locale')) setLocale(nextProfile.locale);
  }, [setLocale]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) await loadCloudGame(data.session.user.id, activeLeagueId);
  }, [activeLeagueId, loadCloudGame]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    const applySession = async (email: string | null, id?: string) => {
      setUserEmail(email); setUserId(id || null);
      if (id) await loadCloudGame(id);
      else { setCoins(10000); setTeam([]); setLeagues([]); setProfile(null); setAccountPortfolio(EMPTY_PORTFOLIO); }
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => applySession(data.session?.user.email || null, data.session?.user.id).catch(() => setLoading(false)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => applySession(session?.user.email || null, session?.user.id).catch(() => setLoading(false)), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadCloudGame]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const client = supabase;
    client.rpc('touch_presence');
    const timer = setInterval(() => client.rpc('touch_presence'), 60000);
    return () => clearInterval(timer);
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const timer = setInterval(() => loadCloudGame(userId, activeLeagueId).catch(() => undefined), 60000);
    return () => clearInterval(timer);
  }, [activeLeagueId, loadCloudGame, userId]);

  const accountTrade = async (action: 'buy' | 'sell', playerId: string) => {
    if (!supabase) return 'Sign in first';
    const { data } = await supabase.auth.getSession();
    if (!data.session) return 'Sign in first';
    const fn = action === 'buy' ? 'account_buy_player' : 'account_sell_player';
    const { error } = await supabase.rpc(fn, { target_player_id: playerId, request_id: crypto.randomUUID() });
    if (error) return error.message;
    await loadCloudGame(data.session.user.id, activeLeagueId);
    return null;
  };

  const addToTeam = async (player: Player) => {
    if (!supabase) return 'Sign in first';
    if (!activeLeagueId) return accountTrade('buy', player.id);
    if (team.some(item => item.id === player.id)) return 'Player already in roster';
    const rosterLimit = leagues.find(league => league.id === activeLeagueId)?.rosterSize || MAX_ROSTER;
    if (team.length >= rosterLimit) return `Roster is full (${rosterLimit} players)`;
    if (coins < player.price) return 'Not enough coins';
    const { data } = await supabase.auth.getSession();
    if (!data.session) return 'Sign in first';
    const result = await supabase.rpc('league_buy_player', { target_league: activeLeagueId, target_player_id: player.id });
    if (result.error) return result.error.message;
    await loadCloudGame(data.session.user.id, activeLeagueId);
    return null;
  };

  const removeFromTeam = async (playerId: string) => {
    if (!supabase) return 'Sign in first';
    if (!activeLeagueId) return accountTrade('sell', playerId);
    const player = team.find(item => item.id === playerId);
    if (!player) return 'Player not in roster';
    const { data } = await supabase.auth.getSession();
    if (!data.session) return 'Sign in first';
    const result = await supabase.rpc('league_sell_player', { target_league: activeLeagueId, target_player_id: playerId });
    if (result.error) return result.error.message;
    await loadCloudGame(data.session.user.id, activeLeagueId);
    return null;
  };

  const rpcAndRefresh = async (fn: string, args: Record<string, unknown>) => {
    if (!supabase || !userId) return 'Sign in first';
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    await loadCloudGame(userId, typeof data === 'string' ? data : activeLeagueId);
    return null;
  };

  const selectLeague = useCallback(async (id: string) => {
    setActiveLeagueId(id);
    localStorage.setItem('fantafort-league', id);
    if (userId) await loadCloudGame(userId, id);
  }, [loadCloudGame, userId]);
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); };

  return <GameContext.Provider value={{
    coins, team, leagues, activeLeagueId, profile, accountPortfolio, loading, userEmail, userId,
    addToTeam, removeFromTeam, selectLeague,
    accountBuyPlayer: playerId => accountTrade('buy', playerId),
    accountSellPlayer: playerId => accountTrade('sell', playerId),
    createLeague: (name, settings) => rpcAndRefresh('create_league', {
      league_name: name, budget: settings.budget, slots: settings.rosterSize,
      market_hours: settings.marketHours, league_days: settings.durationDays, mode: settings.scoringMode,
      economy: settings.economyMode, stake: settings.entryStake, draft: settings.draftMode,
    }),
    joinLeague: code => rpcAndRefresh('join_league', { code }),
    startLeague: id => rpcAndRefresh('start_league', { target_league: id }),
    finishLeague: id => rpcAndRefresh('finish_league', { target_league: id }),
    leaveLeague: id => rpcAndRefresh('leave_league', { target_league: id }),
    cancelLeague: id => rpcAndRefresh('cancel_league', { target_league: id }),
    saveProfile: (username, locale) => rpcAndRefresh('update_profile', { new_username: username, new_locale: locale }),
    saveCommunicationPreference: enabled => rpcAndRefresh('update_communication_preferences', {
      enabled, consent_version:COMMUNICATION_CONSENT_VERSION, consent_source:'account_settings',
    }),
    savePublicLineupVisibility: enabled => rpcAndRefresh('set_public_lineup_visibility', { enabled }),
    buyCosmetic: slug => rpcAndRefresh('buy_cosmetic', { cosmetic_slug: slug, request_id:crypto.randomUUID() }),
    equipCosmetic: (kind, slug) => rpcAndRefresh('equip_cosmetic', { cosmetic_kind: kind, cosmetic_slug: slug }),
    refresh, signOut,
  }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
}
