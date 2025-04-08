import axios from 'axios';
import { mockPlayerStats, generateMockPlayerStats, mockProPlayers, generateMockPlayers, mockTournaments } from './mock-data';

// Interface for Fortnite player statistics
interface FortniteStats {
  account: {
    id: string;
    name: string;
  };
  stats: {
    all: {
      overall: {
        wins: number;
        winRate: number;
        kills: number;
        kd: number;
        matches: number;
        top10: number;
        top25: number;
      };
    };
  };
}

/**
 * Fetches player statistics from Fortnite Tracker API
 * @param playerName - The Fortnite player's username/epic name
 * @returns Promise with player statistics
 */
export async function fetchFortnitePlayerStats(playerName: string): Promise<FortniteStats | null> {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.FORTNITE_TRACKER_API_KEY || '';

    // If no API key or we're in development mode, use mock data
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log(`Using mock data for player ${playerName}`);
      const mockData = generateMockPlayerStats(playerName.toLowerCase(), playerName);

      // Format the mock data according to our interface
      return {
        account: {
          id: mockData.accountId,
          name: mockData.displayName
        },
        stats: {
          all: {
            overall: {
              wins: mockData.lifetimeStats.wins,
              winRate: mockData.lifetimeStats.winRate,
              kills: mockData.lifetimeStats.kills,
              kd: mockData.lifetimeStats.kd,
              matches: mockData.lifetimeStats.matchesPlayed,
              top10: mockData.lifetimeStats.top10,
              top25: mockData.lifetimeStats.top25
            }
          }
        }
      };
    }

    try {
      // Make the API request to Fortnite Tracker
      const response = await axios.get(`https://api.fortnitetracker.com/v1/profile/all/${encodeURIComponent(playerName)}`, {
        headers: {
          'TRN-Api-Key': apiKey
        }
      });

      // Return the response data
      return response.data;
    } catch (apiError) {
      // Log the error but don't expose sensitive details
      if (axios.isAxiosError(apiError)) {
        if (apiError.response) {
          console.error(`Fortnite Tracker API Error: ${apiError.response.status} - ${apiError.response.statusText}`);
        } else if (apiError.request) {
          console.error('Fortnite Tracker API Error: No response received');
        } else {
          console.error(`Fortnite Tracker API Error: ${apiError.message}`);
        }
      } else {
        console.error(`Fortnite Tracker API Error: ${apiError}`);
      }

      console.log('Falling back to mock data');

      // Fall back to mock data
      const mockData = generateMockPlayerStats(playerName.toLowerCase(), playerName);

      // Format the mock data according to our interface
      return {
        account: {
          id: mockData.accountId,
          name: mockData.displayName
        },
        stats: {
          all: {
            overall: {
              wins: mockData.lifetimeStats.wins,
              winRate: mockData.lifetimeStats.winRate,
              kills: mockData.lifetimeStats.kills,
              kd: mockData.lifetimeStats.kd,
              matches: mockData.lifetimeStats.matchesPlayed,
              top10: mockData.lifetimeStats.top10,
              top25: mockData.lifetimeStats.top25
            }
          }
        }
      };
    }
  } catch (error) {
    console.error(`Error in fetchFortnitePlayerStats for player ${playerName}:`, error);

    // Return mock data as fallback
    const mockData = generateMockPlayerStats(playerName.toLowerCase(), playerName);

    // Format the mock data according to our interface
    return {
      account: {
        id: mockData.accountId,
        name: mockData.displayName
      },
      stats: {
        all: {
          overall: {
            wins: mockData.lifetimeStats.wins,
            winRate: mockData.lifetimeStats.winRate,
            kills: mockData.lifetimeStats.kills,
            kd: mockData.lifetimeStats.kd,
            matches: mockData.lifetimeStats.matchesPlayed,
            top10: mockData.lifetimeStats.top10,
            top25: mockData.lifetimeStats.top25
          }
        }
      }
    };
  }
}

/**
 * Processes raw Fortnite stats into a format used by the fantasy application
 * @param rawStats - The raw stats from Fortnite Tracker API
 * @returns Processed stats for fantasy application
 */
export function processPlayerStats(rawStats: FortniteStats | null) {
  if (!rawStats || !rawStats.stats || !rawStats.stats.all || !rawStats.stats.all.overall) {
    return {
      eliminations: 0,
      winRate: 0,
      kd: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  const stats = rawStats.stats.all.overall;

  return {
    eliminations: stats.kills || 0,
    winRate: parseFloat((stats.winRate || 0).toFixed(1)),
    kd: parseFloat((stats.kd || 0).toFixed(1)),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Searches for Fortnite players by name
 * @param searchTerm - The search term to find players
 * @returns Promise with search results
 */
export async function searchFornitePlayers(searchTerm: string) {
  try {
    const apiKey = process.env.FORTNITE_TRACKER_API_KEY || '';

    // If no API key or we're in development mode, use mock data
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log(`Using mock data for player search: ${searchTerm}`);

      // Generate mock search results based on the search term
      const mockResults = [];
      const mockPlayers = generateMockPlayers(20);

      // Filter players whose names contain the search term
      for (const player of mockPlayers) {
        if (player.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          mockResults.push({
            accountId: player.id,
            platformId: 1,
            platformName: 'epic',
            platformNameLong: 'Epic Games',
            epicUserHandle: player.name,
            avatarUrl: player.avatar
          });
        }
      }

      return mockResults;
    }

    try {
      const response = await axios.get(`https://api.fortnitetracker.com/v1/search?platform=all&query=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'TRN-Api-Key': apiKey
        }
      });

      return response.data;
    } catch (apiError) {
      if (axios.isAxiosError(apiError)) {
        if (apiError.response) {
          console.error(`Fortnite Tracker Search API Error: ${apiError.response.status} - ${apiError.response.statusText}`);
        } else if (apiError.request) {
          console.error('Fortnite Tracker Search API Error: No response received');
        } else {
          console.error(`Fortnite Tracker Search API Error: ${apiError.message}`);
        }
      } else {
        console.error(`Fortnite Tracker Search API Error: ${apiError}`);
      }

      console.log('Falling back to mock data for search');

      // Generate mock search results based on the search term
      const mockResults = [];
      const mockPlayers = generateMockPlayers(20);

      // Filter players whose names contain the search term
      for (const player of mockPlayers) {
        if (player.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          mockResults.push({
            accountId: player.id,
            platformId: 1,
            platformName: 'epic',
            platformNameLong: 'Epic Games',
            epicUserHandle: player.name,
            avatarUrl: player.avatar
          });
        }
      }

      return mockResults;
    }
  } catch (error) {
    console.error(`Error in searchFornitePlayers for term ${searchTerm}:`, error);

    // Return empty array as fallback
    return [];
  }
}

/**
 * Gets pro player information from Fortnite events
 * @returns Promise with pro player information
 */
export async function getFortniteProPlayers() {
  try {
    const apiKey = process.env.FORTNITE_TRACKER_API_KEY || '';

    // If no API key or we're in development mode, use mock data
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log('Using mock data for pro players');
      return mockProPlayers;
    }

    try {
      // In a real implementation, this would fetch from the events or pro player endpoint
      // This is a simplified placeholder since the exact endpoint might vary
      const response = await axios.get('https://api.fortnitetracker.com/v1/events', {
        headers: {
          'TRN-Api-Key': apiKey
        }
      });

      return response.data;
    } catch (apiError) {
      if (axios.isAxiosError(apiError)) {
        if (apiError.response) {
          console.error(`Fortnite Events API Error: ${apiError.response.status} - ${apiError.response.statusText}`);
        } else if (apiError.request) {
          console.error('Fortnite Events API Error: No response received');
        } else {
          console.error(`Fortnite Events API Error: ${apiError.message}`);
        }
      } else {
        console.error(`Fortnite Events API Error: ${apiError}`);
      }

      console.log('Falling back to mock data for pro players');
      return mockProPlayers;
    }
  } catch (error) {
    console.error(`Error in getFortniteProPlayers:`, error);
    return mockProPlayers;
  }
}

/**
 * Gets Fortnite tournament data
 * @returns Promise with tournament information
 */
export async function getFortniteTournaments() {
  try {
    const apiKey = process.env.FORTNITE_TRACKER_API_KEY || '';

    // If no API key or we're in development mode, use mock data
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log('Using mock data for tournaments');
      return mockTournaments;
    }

    try {
      const response = await axios.get('https://api.fortnitetracker.com/v1/events/get-events', {
        headers: {
          'TRN-Api-Key': apiKey
        }
      });

      return response.data;
    } catch (apiError) {
      if (axios.isAxiosError(apiError)) {
        if (apiError.response) {
          console.error(`Fortnite Events API Error: ${apiError.response.status} - ${apiError.response.statusText}`);
        } else if (apiError.request) {
          console.error('Fortnite Events API Error: No response received');
        } else {
          console.error(`Fortnite Events API Error: ${apiError.message}`);
        }
      } else {
        console.error(`Fortnite Events API Error: ${apiError}`);
      }

      console.log('Falling back to mock data for tournaments');
      return mockTournaments;
    }
  } catch (error) {
    console.error(`Error in getFortniteTournaments:`, error);
    return mockTournaments;
  }
}
