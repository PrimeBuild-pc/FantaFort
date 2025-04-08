import axios from 'axios';

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
    
    if (!apiKey) {
      console.error('FORTNITE_TRACKER_API_KEY is not set in environment variables');
      throw new Error('API key not configured');
    }
    
    // Make the API request to Fortnite Tracker
    const response = await axios.get(`https://api.fortnitetracker.com/v1/profile/all/${encodeURIComponent(playerName)}`, {
      headers: {
        'TRN-Api-Key': apiKey
      }
    });
    
    // Return the response data
    return response.data;
  } catch (error) {
    // Log the error but don't expose sensitive details
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Fortnite Tracker API Error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        console.error('Fortnite Tracker API Error: No response received');
      } else {
        console.error(`Fortnite Tracker API Error: ${error.message}`);
      }
    } else {
      console.error(`Fortnite Tracker API Error: ${error}`);
    }
    
    return null;
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
    
    if (!apiKey) {
      console.error('FORTNITE_TRACKER_API_KEY is not set in environment variables');
      throw new Error('API key not configured');
    }
    
    const response = await axios.get(`https://api.fortnitetracker.com/v1/search?platform=all&query=${encodeURIComponent(searchTerm)}`, {
      headers: {
        'TRN-Api-Key': apiKey
      }
    });
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Fortnite Tracker Search API Error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        console.error('Fortnite Tracker Search API Error: No response received');
      } else {
        console.error(`Fortnite Tracker Search API Error: ${error.message}`);
      }
    } else {
      console.error(`Fortnite Tracker Search API Error: ${error}`);
    }
    
    return null;
  }
}

/**
 * Gets pro player information from Fortnite events
 * @returns Promise with pro player information
 */
export async function getFortniteProPlayers() {
  try {
    const apiKey = process.env.FORTNITE_TRACKER_API_KEY || '';
    
    if (!apiKey) {
      console.error('FORTNITE_TRACKER_API_KEY is not set in environment variables');
      throw new Error('API key not configured');
    }
    
    // In a real implementation, this would fetch from the events or pro player endpoint
    // This is a simplified placeholder since the exact endpoint might vary
    const response = await axios.get('https://api.fortnitetracker.com/v1/events', {
      headers: {
        'TRN-Api-Key': apiKey
      }
    });
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Fortnite Events API Error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        console.error('Fortnite Events API Error: No response received');
      } else {
        console.error(`Fortnite Events API Error: ${error.message}`);
      }
    } else {
      console.error(`Fortnite Events API Error: ${error}`);
    }
    
    return null;
  }
}

/**
 * Gets Fortnite tournament data
 * @returns Promise with tournament information
 */
export async function getFortniteTournaments() {
  try {
    const apiKey = process.env.FORTNITE_TRACKER_API_KEY || '';
    
    if (!apiKey) {
      console.error('FORTNITE_TRACKER_API_KEY is not set in environment variables');
      throw new Error('API key not configured');
    }
    
    const response = await axios.get('https://api.fortnitetracker.com/v1/events/get-events', {
      headers: {
        'TRN-Api-Key': apiKey
      }
    });
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Fortnite Events API Error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        console.error('Fortnite Events API Error: No response received');
      } else {
        console.error(`Fortnite Events API Error: ${error.message}`);
      }
    } else {
      console.error(`Fortnite Events API Error: ${error}`);
    }
    
    return null;
  }
}
