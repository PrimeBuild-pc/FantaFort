import axios from 'axios';
import { calculatePlayerScore, rankPlayers, updatePlayerRankings, getTopPlayers, ScoredPlayer, PlayerStats } from './scoring';
import { getWebSocketManager } from './websocket';

// Interface for pro player data
interface ProPlayer extends ScoredPlayer {
  id: string;
  name: string;
  team: string;
  avatar?: string;
  eliminations: number;
  winRate: number;
  kd: number;
}

// Cache for pro player data
let proPlayersCache: ProPlayer[] = [];
let lastUpdated: Date | null = null;
const UPDATE_INTERVAL = 3600000; // 1 hour in milliseconds

/**
 * Fetch pro player data from Fortnite Tracker API
 * @returns Promise with pro player data
 */
export async function fetchProPlayers(): Promise<ProPlayer[]> {
  try {
    // Check if we have cached data that's still fresh
    if (proPlayersCache.length > 0 && lastUpdated && (Date.now() - lastUpdated.getTime() < UPDATE_INTERVAL)) {
      console.log('Using cached pro player data');
      return proPlayersCache;
    }

    const apiKey = process.env.FORTNITE_TRACKER_API_KEY || '';

    if (!apiKey) {
      console.error('FORTNITE_TRACKER_API_KEY is not set in environment variables');
      throw new Error('API key not configured');
    }

    // In a real implementation, this would fetch from the Fortnite Tracker API
    // For now, we'll use a simplified approach to demonstrate the concept

    // Fetch top players from the API
    const response = await axios.get('https://fortnitetracker.com/api/v1/powerrankings/top500', {
      headers: {
        'TRN-Api-Key': apiKey
      }
    });

    // Process the response data
    const players = response.data.map((player: any) => ({
      id: player.accountId,
      name: player.name,
      team: player.team || 'Free Agent',
      avatar: player.avatar,
      placements: player.recentPlacements || [],
      prPoints: player.points || 0,
      earnings: player.earnings || 0,
      eliminations: player.eliminations || 0,
      winRate: player.winRate || 0,
      kd: player.kd || 0,
      playerId: player.accountId,
      playerName: player.name
    }));

    // Calculate scores and rankings
    const rankedPlayers = rankPlayers(players);

    // Update cache
    proPlayersCache = rankedPlayers;
    lastUpdated = new Date();

    return rankedPlayers;
  } catch (error) {
    console.error('Error fetching pro players:', error);

    // If we have cached data, return it even if it's stale
    if (proPlayersCache.length > 0) {
      console.log('Using stale cached pro player data due to API error');
      return proPlayersCache;
    }

    // If we have no cached data, return sample data
    return getSampleProPlayers();
  }
}

/**
 * Get the top N pro players
 * @param limit Number of players to return
 * @returns Promise with top N pro players
 */
export async function getTopProPlayers(limit: number = 500): Promise<ProPlayer[]> {
  const players = await fetchProPlayers();
  return getTopPlayers(players, limit);
}

/**
 * Update pro player rankings
 * @returns Promise with updated rankings
 */
export async function updateProPlayerRankings(): Promise<ProPlayer[]> {
  try {
    // Store previous rankings
    const previousRankings = [...proPlayersCache];

    // Fetch fresh data
    const apiKey = process.env.FORTNITE_TRACKER_API_KEY || '';

    if (!apiKey) {
      console.error('FORTNITE_TRACKER_API_KEY is not set in environment variables');
      throw new Error('API key not configured');
    }

    // Fetch updated data from the API
    const response = await axios.get('https://fortnitetracker.com/api/v1/powerrankings/top500', {
      headers: {
        'TRN-Api-Key': apiKey
      }
    });

    // Process the response data
    const players = response.data.map((player: any) => ({
      id: player.accountId,
      name: player.name,
      team: player.team || 'Free Agent',
      avatar: player.avatar,
      placements: player.recentPlacements || [],
      prPoints: player.points || 0,
      earnings: player.earnings || 0,
      eliminations: player.eliminations || 0,
      winRate: player.winRate || 0,
      kd: player.kd || 0,
      playerId: player.accountId,
      playerName: player.name
    }));

    // Update rankings with previous rank information
    const updatedRankings = updatePlayerRankings(players, previousRankings);

    // Update cache
    proPlayersCache = updatedRankings;
    lastUpdated = new Date();

    // Notify clients about ranking changes via WebSocket
    const websocketManager = getWebSocketManager();
    if (websocketManager) {
      updatedRankings.forEach(player => {
        if (player.rank !== player.previousRank) {
          websocketManager.notifyProPlayerRankingUpdate(
            player.id,
            player.name,
            player.rank || 0,
            player.previousRank || 0,
            player.score || 0
          );
        }
      });
    }

    return updatedRankings;
  } catch (error) {
    console.error('Error updating pro player rankings:', error);
    return proPlayersCache;
  }
}

/**
 * Get sample pro player data for testing
 * @returns Array of sample pro players
 */
function getSampleProPlayers(): ProPlayer[] {
  const samplePlayers: ProPlayer[] = [
    {
      id: 'player1',
      name: 'Bugha',
      team: 'Sentinels',
      avatar: 'https://example.com/avatar1.jpg',
      placements: [
        { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 1, date: '2023-03-15' },
        { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 3, date: '2023-02-20' }
      ],
      prPoints: 85000,
      earnings: 750000,
      eliminations: 450,
      winRate: 15,
      kd: 4.5,
      playerId: 'player1',
      playerName: 'Bugha',
      score: 0,
      placementScore: 0,
      prScore: 0,
      earningsScore: 0
    },
    {
      id: 'player2',
      name: 'MrSavage',
      team: '100 Thieves',
      avatar: 'https://example.com/avatar2.jpg',
      placements: [
        { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 2, date: '2023-03-15' },
        { tournamentId: 't3', tournamentName: 'Cash Cup', placement: 1, date: '2023-01-10' }
      ],
      prPoints: 78000,
      earnings: 680000,
      eliminations: 420,
      winRate: 14,
      kd: 4.2,
      playerId: 'player2',
      playerName: 'MrSavage',
      score: 0,
      placementScore: 0,
      prScore: 0,
      earningsScore: 0
    },
    {
      id: 'player3',
      name: 'Mongraal',
      team: 'FaZe Clan',
      avatar: 'https://example.com/avatar3.jpg',
      placements: [
        { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 5, date: '2023-03-15' },
        { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 2, date: '2023-02-20' }
      ],
      prPoints: 72000,
      earnings: 620000,
      eliminations: 400,
      winRate: 13,
      kd: 4.0,
      playerId: 'player3',
      playerName: 'Mongraal',
      score: 0,
      placementScore: 0,
      prScore: 0,
      earningsScore: 0
    },
    {
      id: 'player4',
      name: 'Benjyfishy',
      team: 'NRG',
      avatar: 'https://example.com/avatar4.jpg',
      placements: [
        { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 4, date: '2023-03-15' },
        { tournamentId: 't3', tournamentName: 'Cash Cup', placement: 3, date: '2023-01-10' }
      ],
      prPoints: 68000,
      earnings: 580000,
      eliminations: 380,
      winRate: 12,
      kd: 3.8,
      playerId: 'player4',
      playerName: 'Benjyfishy',
      score: 0,
      placementScore: 0,
      prScore: 0,
      earningsScore: 0
    },
    {
      id: 'player5',
      name: 'Clix',
      team: 'NRG',
      avatar: 'https://example.com/avatar5.jpg',
      placements: [
        { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 3, date: '2023-03-15' },
        { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 5, date: '2023-02-20' }
      ],
      prPoints: 65000,
      earnings: 550000,
      eliminations: 360,
      winRate: 11,
      kd: 3.6,
      playerId: 'player5',
      playerName: 'Clix',
      score: 0,
      placementScore: 0,
      prScore: 0,
      earningsScore: 0
    }
  ];

  // Calculate scores and rankings
  return rankPlayers(samplePlayers);
}

/**
 * Schedule regular updates of pro player rankings
 * @param intervalMs Update interval in milliseconds (default: 1 hour)
 */
export function scheduleProPlayerUpdates(intervalMs: number = UPDATE_INTERVAL): void {
  // Initial update
  updateProPlayerRankings().then(() => {
    console.log('Initial pro player rankings updated');
  });

  // Schedule regular updates
  setInterval(() => {
    updateProPlayerRankings().then(() => {
      console.log('Pro player rankings updated');
    });
  }, intervalMs);
}
