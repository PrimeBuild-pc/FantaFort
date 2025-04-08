// WebSocket message types
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
  AUTHENTICATION_SUCCESS = 'AUTHENTICATION_SUCCESS',
  PLAYER_STATS_UPDATE = 'PLAYER_STATS_UPDATE',
  PRO_PLAYER_RANKING_UPDATE = 'PRO_PLAYER_RANKING_UPDATE',
}

// WebSocket message interface
export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  timestamp: number;
}

// Player stats update payload
export interface PlayerStatsUpdatePayload {
  playerId: string;
  playerName: string;
  stats: {
    eliminations: number;
    winRate: number;
    kd: number;
    points: number;
    score: number;
  };
}

// Pro player ranking update payload
export interface ProPlayerRankingUpdatePayload {
  playerId: string;
  playerName: string;
  rank: number;
  previousRank: number;
  score: number;
}
