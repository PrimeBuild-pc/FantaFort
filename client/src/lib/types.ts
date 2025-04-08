export interface FortnitePlayer {
  id: string;
  name: string;
  team: string;
  avatar: string;
  points: number;
  price: number;
  rarity: string;
  role: string;
  isTeamCaptain: boolean | null;
  teamId: string | null;
  userId: number | null;
  // Stats directly on player object
  eliminations: number;
  winRate: number;
  kd: number;
  accuracy?: number;
  buildSpeed?: number;
  clutchFactor?: number;
  consistency?: number;
  tournaments?: number;
  avgPlacement?: number;
  // Additional fields
  lastUpdatedAt: string;
  historicalPerformance?: any | null;
  weeklyPoints?: number;
  monthlyPoints?: number;
  seasonPoints?: number;
  seasonTrend?: string;
  // Legacy support for components that still expect stats object
  stats?: {
    eliminations: number;
    winRate: number;
    kd: number;
    accuracy?: number;
    buildSpeed?: number;
    clutchFactor?: number;
    consistency?: number;
    tournaments?: number;
    avgPlacement?: number;
  };
  priceChange?: {
    amount: number;
    percentage: number;
    direction: 'UP' | 'DOWN' | 'STABLE';
  };
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
  members: string[];
  rank: number;
  points: number;
  logo?: string;
}

export interface TeamMember {
  id: string;
  username: string;
  avatar: string;
}

export interface RankedTeam {
  id: string;
  name: string;
  points: number;
  rank: number;
  isUserTeam: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  time: string;
  type: 'MAJOR' | 'MINOR';
  prizePool: number;
  registeredTeams: number;
  maxTeams: number;
  isUserTeamRegistered?: boolean;
}

export interface User {
  id: number;
  username: string;
  coins: number;
  teamId?: string;
}

export interface PerformanceHistory {
  id: number;
  playerId: string;
  date: Date | string;
  points: number;
  eliminations: number | null;
  winRate: number | null;
  kd: number | null;
  weekNumber: number | null;
}

export interface StatsShare {
  id: string;
  shareCode: string;
  teamId: string | null;
  userId: number | null;
  playerId: string | null;
  createdAt: Date | string;
  expiresAt: Date | string | null;
  isActive: boolean;
  accessCount: number;
  maxAccesses: number | null;
}

export interface AccessRequest {
  id: number;
  requestorId: number;
  targetId: string;
  targetType: 'TEAM' | 'PLAYER' | 'USER';
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  requestedAt: Date | string;
  responseAt: Date | string | null;
  message: string | null;
}

export interface GamePhase {
  id: string;
  name: string;
  description: string;
  startTime: Date | string;
  endTime: Date | string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  type: 'DRAFT' | 'REGULAR_SEASON' | 'PLAYOFFS' | 'TRANSFER_WINDOW' | 'OFF_SEASON';
  notificationSent: boolean;
}

export interface GameSettings {
  id: string;
  seasonName: string;
  seasonStartDate: Date | string;
  seasonEndDate: Date | string;
  startingCoins: number;
  transferWindowDuration: number; // in hours
  priceUpdateFrequency: number; // in hours
  minPlayerPrice: number;
  maxPlayerPrice: number;
  draftEnabled: boolean;
  draftDate: Date | string | null;
  draftDuration: number; // in minutes
  currentPhaseId: string | null;
}

export interface PriceUpdateEvent {
  id: string;
  playerId: string;
  oldPrice: number;
  newPrice: number;
  updateTime: Date | string;
  reason: 'PERFORMANCE' | 'MARKET_DEMAND' | 'SCHEDULED_UPDATE' | 'ADMIN_ADJUSTMENT';
}

export interface Notification {
  id: string;
  userId: number | null; // null means broadcast to all users
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' | 'TRANSFER_WINDOW' | 'PRICE_CHANGE' | 'GAME_PHASE';
  createdAt: Date | string;
  readAt: Date | string | null;
  relatedEntityId?: string; // ID of related entity (player, tournament, etc.)
  relatedEntityType?: 'PLAYER' | 'TEAM' | 'TOURNAMENT' | 'GAME_PHASE';
}

// Define WebSocket message types
export enum WebSocketMessageType {
  USER_CONNECTED = 'USER_CONNECTED',
  USER_DISCONNECTED = 'USER_DISCONNECTED',
  PLAYER_PRICE_UPDATE = 'PLAYER_PRICE_UPDATE',
  PLAYER_TRANSFER = 'PLAYER_TRANSFER',
  PLAYER_ACQUIRED = 'PLAYER_ACQUIRED',
  MARKET_UPDATE = 'MARKET_UPDATE',
  TEAM_UPDATE = 'TEAM_UPDATE',
  TOURNAMENT_UPDATE = 'TOURNAMENT_UPDATE',
  TOURNAMENT_REGISTRATION = 'TOURNAMENT_REGISTRATION',
  TOURNAMENT_LEADERBOARD_UPDATE = 'TOURNAMENT_LEADERBOARD_UPDATE',
  GAME_PHASE_CHANGE = 'GAME_PHASE_CHANGE',
  NEW_NOTIFICATION = 'NEW_NOTIFICATION',
  AUTHENTICATION_SUCCESS = 'AUTHENTICATION_SUCCESS'
}
