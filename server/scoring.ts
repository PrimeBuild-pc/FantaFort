/**
 * Scoring algorithm for Fortnite pro players
 *
 * This module implements a scoring algorithm for ranking Fortnite pro players based on:
 * - Tournament placements (50%)
 * - PR Points (30%)
 * - Earnings (20%)
 */

export interface TournamentPlacement {
  tournamentId: string;
  tournamentName: string;
  placement: number;
  date: string;
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  placements: TournamentPlacement[];
  prPoints: number;
  earnings: number;
  eliminations?: number;
  winRate?: number;
  kd?: number;
}

export interface ScoredPlayer extends PlayerStats {
  score: number;
  placementScore: number;
  prScore: number;
  earningsScore: number;
  rank?: number;
  previousRank?: number;
}

// Configuration for the scoring algorithm
const SCORING_CONFIG = {
  // Weights for each component (must sum to 1)
  weights: {
    placements: 0.5,  // 50%
    prPoints: 0.3,    // 30%
    earnings: 0.2,    // 20%
  },
  // Maximum values for normalization
  maxValues: {
    prPoints: 100000,  // Maximum PR points to consider
    earnings: 1000000, // Maximum earnings to consider (in USD)
  },
  // Placement scoring
  placement: {
    firstPlace: 100,   // Score for 1st place
    decrement: 1,      // Score decrement per position
    minScore: 5,       // Minimum score for a placement
  }
};

/**
 * Calculate placement score based on tournament results
 * Uses a decreasing score system: 1st place gets 100 points, 2nd gets 99, etc.
 *
 * @param placements Array of tournament placements
 * @returns Normalized placement score (0-100)
 */
function calculatePlacementScore(placements: TournamentPlacement[]): number {
  if (!placements || placements.length === 0) {
    return 0;
  }

  // Sort placements by date (most recent first)
  const sortedPlacements = [...placements].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate score for each placement
  const placementScores = sortedPlacements.map(placement => {
    const position = placement.placement;
    const score = Math.max(
      SCORING_CONFIG.placement.firstPlace - ((position - 1) * SCORING_CONFIG.placement.decrement),
      SCORING_CONFIG.placement.minScore
    );
    return score;
  });

  // Calculate average score, weighted more heavily toward recent tournaments
  let totalWeight = 0;
  let weightedSum = 0;

  placementScores.forEach((score, index) => {
    // Apply recency bias - more recent tournaments have higher weight
    const weight = 1 / (index + 1);
    weightedSum += score * weight;
    totalWeight += weight;
  });

  // Normalize to 0-100 scale
  return totalWeight > 0 ? (weightedSum / totalWeight) : 0;
}

/**
 * Normalize PR Points to a 0-100 scale
 *
 * @param prPoints Player's PR points
 * @returns Normalized PR score (0-100)
 */
function normalizePRPoints(prPoints: number): number {
  if (prPoints <= 0) {
    return 0;
  }

  // Apply logarithmic scaling to handle the wide range of PR points
  const normalizedScore = Math.min(
    100,
    (Math.log10(prPoints) / Math.log10(SCORING_CONFIG.maxValues.prPoints)) * 100
  );

  return normalizedScore;
}

/**
 * Normalize earnings to a 0-100 scale
 *
 * @param earnings Player's earnings in USD
 * @returns Normalized earnings score (0-100)
 */
function normalizeEarnings(earnings: number): number {
  if (earnings <= 0) {
    return 0;
  }

  // Apply logarithmic scaling to handle the wide range of earnings
  const normalizedScore = Math.min(
    100,
    (Math.log10(earnings) / Math.log10(SCORING_CONFIG.maxValues.earnings)) * 100
  );

  return normalizedScore;
}

/**
 * Calculate the overall score for a player
 *
 * @param player Player stats
 * @returns Player with calculated scores
 */
export function calculatePlayerScore(player: PlayerStats): ScoredPlayer {
  // Calculate individual component scores
  const placementScore = calculatePlacementScore(player.placements);
  const prScore = normalizePRPoints(player.prPoints);
  const earningsScore = normalizeEarnings(player.earnings);

  // Calculate weighted overall score
  const overallScore = (
    (placementScore * SCORING_CONFIG.weights.placements) +
    (prScore * SCORING_CONFIG.weights.prPoints) +
    (earningsScore * SCORING_CONFIG.weights.earnings)
  );

  // Return player with scores
  return {
    ...player,
    score: Math.round(overallScore * 100) / 100, // Round to 2 decimal places
    placementScore: Math.round(placementScore * 100) / 100,
    prScore: Math.round(prScore * 100) / 100,
    earningsScore: Math.round(earningsScore * 100) / 100
  };
}

/**
 * Rank a list of players based on their scores
 *
 * @param players Array of players with stats
 * @returns Array of ranked players
 */
export function rankPlayers(players: PlayerStats[]): ScoredPlayer[] {
  // Calculate scores for all players
  const scoredPlayers = players.map(player => calculatePlayerScore(player));

  // Sort by score (descending)
  const rankedPlayers = scoredPlayers.sort((a, b) => b.score - a.score);

  // Assign ranks
  return rankedPlayers.map((player, index) => ({
    ...player,
    rank: index + 1
  }));
}

/**
 * Update player rankings and track changes
 *
 * @param currentPlayers Current player rankings
 * @param previousPlayers Previous player rankings
 * @returns Updated player rankings with previous ranks
 */
export function updatePlayerRankings(
  currentPlayers: PlayerStats[],
  previousPlayers: ScoredPlayer[]
): ScoredPlayer[] {
  // Calculate new rankings
  const newRankings = rankPlayers(currentPlayers);

  // Create a map of previous rankings for quick lookup
  const previousRankMap = new Map<string, number>();
  previousPlayers.forEach(player => {
    previousRankMap.set(player.playerId, player.rank || 0);
  });

  // Add previous rank information
  return newRankings.map(player => ({
    ...player,
    previousRank: previousRankMap.get(player.playerId) || 0
  }));
}

/**
 * Get the top N players from the rankings
 *
 * @param players Ranked players
 * @param limit Number of players to return
 * @returns Top N players
 */
export function getTopPlayers(players: ScoredPlayer[], limit: number = 500): ScoredPlayer[] {
  return players.slice(0, limit);
}
