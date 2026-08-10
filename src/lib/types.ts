import { Locale } from './i18n';

export interface Player {
  id: string;
  handle: string;
  realName?: string | null;
  team?: string | null;
  photoUrl?: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number;
  earnings?: number | null;
  birthDate?: string | null;
  tournamentPoints?: number;
  cupsPlayed?: number;
  tournamentWins?: number;
  bestPlacement?: number | null;
  averagePlacement?: number | null;
  pointsPerMatch?: number;
  winRate?: number;
  priceChange?: number;
  teammates?: { id: string; handle: string; windowId: string }[];
  eligibility?: string;
}

export interface PublicBadge {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export interface Profile {
  username: string;
  locale: Locale;
  rewardPoints: number;
  experiencePoints: number;
  isAdmin: boolean;
  walletCents: number;
  nameStyle: 'default' | 'storm' | 'victory' | 'legendary';
  communityEmailOptIn: boolean;
  communityEmailOptedInAt: string | null;
  communityEmailOptedOutAt: string | null;
  publicLineupEnabled: boolean;
}

export interface PublicLineupPlayer {
  playerId: string;
  handle: string;
  realName: string | null;
  team: string | null;
  photoUrl: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  currentPrice: number;
}

export interface PublicLineup {
  username: string;
  nameStyle: Profile['nameStyle'];
  rank: number;
  netWorth: number;
  badges: PublicBadge[];
  lineup: PublicLineupPlayer[];
}

export function getLevelProgress(experiencePoints: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, experiencePoints) / 100)) + 1;
  const start = (level - 1) ** 2 * 100;
  const end = level ** 2 * 100;
  const badge = level >= 10 ? 'legend' : level >= 5 ? 'elite' : level >= 3 ? 'contender' : 'rookie';
  return { level, current: experiencePoints - start, required: end - start, badge } as const;
}

export interface AccountPosition {
  playerId: string;
  handle: string;
  photoUrl?: string | null;
  rarity: Player['rarity'];
  currentPrice: number;
  acquiredPrice: number;
  acquiredAt: string;
  pnl: number;
  dailyChange?: number;
}

export interface AccountPortfolio {
  balance: number;
  lockedBalance: number;
  holdingsValue: number;
  totalEquity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  dailyPnl: number;
  rescueAvailable: boolean;
  rescueReason: 'available' | 'wealth' | 'account_age' | 'cooldown';
  nextRescueAt?: string | null;
  positions: AccountPosition[];
}

export interface LeagueSettings {
  budget: number;
  rosterSize: number;
  marketHours: number;
  durationDays: number;
  scoringMode: 'classic' | 'balanced' | 'formation';
  economyMode: 'demo' | 'account_stake';
  entryStake: 0 | 500 | 1000 | 2000;
  draftMode: 'market' | 'auction';
}

export interface League extends LeagueSettings {
  id: string;
  name: string;
  inviteCode: string;
  status: 'lobby' | 'active' | 'completed' | 'cancelled';
  ownerId: string;
  members: number;
  startsAt?: string | null;
  endsAt?: string | null;
  marketClosesAt?: string | null;
}
