import axios from 'axios';
import { calculatePlayerScore, rankPlayers, updatePlayerRankings, getTopPlayers, ScoredPlayer, PlayerStats } from './scoring';
import { getWebSocketManager } from './websocket';
import { mockProPlayers, generateMockPlayers } from './mock-data';

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

    // If no API key or we're in development mode, use mock data
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log('Using mock pro player data');
      const mockPlayers = generateMockPlayers(100);

      // Update cache
      proPlayersCache = mockPlayers;
      lastUpdated = new Date();

      return mockPlayers;
    }

    try {
      // Attempt to fetch from the real API
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
    } catch (apiError) {
      console.error('Error fetching from Fortnite Tracker API:', apiError);
      console.log('Falling back to mock data');

      // Fall back to mock data
      const mockPlayers = generateMockPlayers(100);

      // Update cache
      proPlayersCache = mockPlayers;
      lastUpdated = new Date();

      return mockPlayers;
    }
  } catch (error) {
    console.error('Error in fetchProPlayers:', error);

    // If we have cached data, return it even if it's stale
    if (proPlayersCache.length > 0) {
      console.log('Using stale cached pro player data due to error');
      return proPlayersCache;
    }

    // If we have no cached data, return mock data
    return generateMockPlayers(100);
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

    // If no API key or we're in development mode, use mock data
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log('Using mock data for pro player rankings update');

      // Generate new mock data with slightly different rankings
      const mockPlayers = generateMockPlayers(100);

      // Update rankings with previous rank information
      const updatedRankings = updatePlayerRankings(mockPlayers, previousRankings);

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
    }

    try {
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
    } catch (apiError) {
      console.error('Error fetching from Fortnite Tracker API:', apiError);
      console.log('Falling back to mock data for rankings update');

      // Fall back to mock data
      const mockPlayers = generateMockPlayers(100);

      // Update rankings with previous rank information
      const updatedRankings = updatePlayerRankings(mockPlayers, previousRankings);

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
    }
  } catch (error) {
    console.error('Error updating pro player rankings:', error);
    return proPlayersCache.length > 0 ? proPlayersCache : generateMockPlayers(100);
  }
}

/**
 * Get sample pro player data for testing
 * @returns Array of sample pro players
 */
function getSampleProPlayers(): ProPlayer[] {
  return mockProPlayers;
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
