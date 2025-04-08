import { storage } from "./storage";
import { InsertPlayer } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

// Array of sample Fortnite pro players for the marketplace
const samplePlayers = [
  {
    name: "Bugha",
    team: "Sentinels",
    avatar: "https://img.redbull.com/images/c_crop,x_0,y_0,h_720,w_1080/c_fill,w_400,h_300/q_auto:low,f_auto/redbullcom/2019/12/27/d08a81ae-1c3c-41fb-aa85-ade5a056a971/bugha-fortnite-world-cup-trophy",
    points: 150,
    price: 8000,
    rarity: "LEGENDARY",
    role: "CAPTAIN",
    eliminations: 78,
    winRate: 20,
    kd: 7,  // Changed from 6.5 to 7 (integer)
    accuracy: 85,
    buildSpeed: 95,
    clutchFactor: 90,
    consistency: 88,
    tournaments: 35,
    avgPlacement: 3,
    weeklyPoints: 520,
    monthlyPoints: 1850,
    seasonPoints: 5200,
    seasonTrend: "RISING"
  },
  {
    name: "Ninja",
    team: "Luminosity Gaming",
    avatar: "https://www.essentiallysports.com/wp-content/uploads/IMG_20200923_195712-1.jpg",
    points: 130,
    price: 7500,
    rarity: "LEGENDARY",
    role: "FLEX",
    eliminations: 65,
    winRate: 18,
    kd: 6,  // Changed from 5.8 to 6 (integer)
    accuracy: 82,
    buildSpeed: 88,
    clutchFactor: 85,
    consistency: 80,
    tournaments: 30,
    avgPlacement: 5,
    weeklyPoints: 480,
    monthlyPoints: 1720,
    seasonPoints: 4900,
    seasonTrend: "STABLE"
  },
  {
    name: "Mongraal",
    team: "FaZe Clan",
    avatar: "https://dotesports.com/wp-content/uploads/2020/03/3b587602-mongraal.jpg",
    points: 145,
    price: 7800,
    rarity: "LEGENDARY",
    role: "FRAGGER",
    eliminations: 85,
    winRate: 17,
    kd: 7, // Changed from 7.2 to 7 (integer)
    accuracy: 86,
    buildSpeed: 96,
    clutchFactor: 87,
    consistency: 82,
    tournaments: 32,
    avgPlacement: 4,
    weeklyPoints: 510,
    monthlyPoints: 1800,
    seasonPoints: 5100,
    seasonTrend: "RISING"
  },
  {
    name: "Clix",
    team: "NRG",
    avatar: "https://www.dexerto.com/cdn-cgi/image/width=640,quality=75,format=auto/https://editors.dexerto.com/wp-content/uploads/2021/04/clix-fortnite-twitch-streamer.jpg",
    points: 140,
    price: 7600,
    rarity: "LEGENDARY",
    role: "BUILDER",
    eliminations: 70,
    winRate: 19,
    kd: 7, // Changed from 6.8 to 7 (integer)
    accuracy: 84,
    buildSpeed: 94,
    clutchFactor: 86,
    consistency: 85,
    tournaments: 34,
    avgPlacement: 4,
    weeklyPoints: 500,
    monthlyPoints: 1780,
    seasonPoints: 5000,
    seasonTrend: "STABLE"
  },
  {
    name: "MrSavage",
    team: "100 Thieves",
    avatar: "https://cdn1.dotesports.com/wp-content/uploads/2021/03/24135414/MrSavage-FN.jpeg",
    points: 135,
    price: 7400,
    rarity: "LEGENDARY",
    role: "SUPPORT",
    eliminations: 60,
    winRate: 22,
    kd: 6, // Changed from 6.0 to 6 (integer)
    accuracy: 88,
    buildSpeed: 89,
    clutchFactor: 92,
    consistency: 90,
    tournaments: 28,
    avgPlacement: 3,
    weeklyPoints: 490,
    monthlyPoints: 1750,
    seasonPoints: 4950,
    seasonTrend: "RISING"
  },
  {
    name: "Benjyfishy",
    team: "NRG",
    avatar: "https://img.redbull.com/images/c_crop,x_0,y_0,h_599,w_899/c_fill,w_400,h_300/q_auto:low,f_auto/redbullcom/2020/6/3/jmmsfpfltpmgzh68pszm/benjyfishy-fortnite",
    points: 142,
    price: 7700,
    rarity: "LEGENDARY",
    role: "FRAGGER",
    eliminations: 75,
    winRate: 20,
    kd: 7, // Changed from 6.7 to 7 (integer)
    accuracy: 87,
    buildSpeed: 92,
    clutchFactor: 88,
    consistency: 86,
    tournaments: 30,
    avgPlacement: 4,
    weeklyPoints: 505,
    monthlyPoints: 1790,
    seasonPoints: 5050,
    seasonTrend: "STABLE"
  },
  {
    name: "Arkhram",
    team: "100 Thieves",
    avatar: "https://cdn1.dotesports.com/wp-content/uploads/2019/12/29134200/Arkhram.jpg",
    points: 125,
    price: 7200,
    rarity: "EPIC",
    role: "FLEX",
    eliminations: 68,
    winRate: 16,
    kd: 6, // Changed from 5.9 to 6 (integer)
    accuracy: 83,
    buildSpeed: 87,
    clutchFactor: 84,
    consistency: 81,
    tournaments: 25,
    avgPlacement: 6,
    weeklyPoints: 470,
    monthlyPoints: 1680,
    seasonPoints: 4750,
    seasonTrend: "RISING"
  },
  {
    name: "Mitro",
    team: "Team Liquid",
    avatar: "https://www.esportsguide.com/wp-content/uploads/2019/09/Mitr0.jpg",
    points: 130,
    price: 7300,
    rarity: "EPIC",
    role: "BUILDER",
    eliminations: 72,
    winRate: 18,
    kd: 6, // Changed from 6.2 to 6 (integer)
    accuracy: 85,
    buildSpeed: 90,
    clutchFactor: 83,
    consistency: 82,
    tournaments: 27,
    avgPlacement: 5,
    weeklyPoints: 480,
    monthlyPoints: 1720,
    seasonPoints: 4850,
    seasonTrend: "STABLE"
  }
];

async function fetchProPlayers() {
  try {
    // Note: This API might be blocked or require authentication
    // For now, we'll return an empty array to avoid blocking app initialization
    console.log('Using sample players instead of live API data');
    return [];
    
    // Original implementation (commented out - requires API access):
    /*
    const response = await fetch('https://fortnitetracker.com/api/v0/leaderboards/players/global');
    // Check if response is actually JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('Received non-JSON response from API. Using sample data instead.');
      return [];
    }
    
    const data = await response.json();
    return data.players.slice(0, 500).map((player: any) => ({
      id: player.accountId,
      name: player.displayName,
      avatar: player.avatarUrl || `https://api.dicebear.com/6.x/avataaars/svg?seed=${player.displayName}`,
      eliminations: player.stats.kills || 0,
      winRate: player.stats.winRate || 0,
      kd: player.stats.kd || 0,
      points: Math.floor(Math.random() * 1000) + 500,
      team: player.team || 'Free Agent',
      isTeamCaptain: false
    }));
    */
  } catch (error) {
    console.error('Error fetching pro players:', error);
    return [];
  }
}

export async function initializePlayers() {
  const proPlayers = await fetchProPlayers();
  try {
    // Check if we already have players in the marketplace
    const existingPlayers = await storage.getMarketplacePlayers();

    if (existingPlayers.length === 0) {
      console.log('No marketplace players found. Adding sample players...');

      // Add sample players to the database
      for (const playerData of samplePlayers.concat(proPlayers)) { 
        const player: InsertPlayer = {
          ...playerData,
          teamId: null,
          userId: null,
          isTeamCaptain: false
        };

        await storage.createPlayer(player);
      }

      console.log(`Added ${samplePlayers.length + proPlayers.length} players to the marketplace`);
    } else {
      console.log(`Marketplace already has ${existingPlayers.length} players. Skipping sample player initialization.`);
    }
  } catch (error) {
    console.error('Failed to initialize marketplace players:', error);
  }
}


// Placeholder for authentication and navbar update.  Replace with your actual implementation.
// This function would handle user login and update the navbar accordingly.
async function handleAuthentication() {
  // ... Your authentication logic here ...
  //  After successful login: updateNavbar();
}

// Placeholder for navbar update. Replace with your actual implementation.
function updateNavbar() {
  // ... Your code to replace the login button with a profile icon ...
}

const styles = `
.card {
    width: 300px;
    height: 400px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23);
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    margin: 10px;
}

.card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.wrapper {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0;
    background-color: rgba(0, 0, 0, 0.6);
    transition: height 0.5s;
    overflow: hidden;
}

.wrapper::before,
.wrapper::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100px;
    background-color: rgba(255, 255, 255, 0.3);
    opacity: 0;
    transition: opacity 0.5s, height 0.5s;
}


.card:hover .wrapper::before,
.card:hover .wrapper::after {
    opacity: 1;
}

.card:hover .wrapper::after {
    height: 120px;
}

.title {
    width: 100%;
    transition: transform 0.5s;
    position: absolute;
    bottom: 20px;
    left: 20px;
    color: white;
}

.card:hover .title {
    transform: translate3d(0%, -50px, 100px);
}
`;

// Add the styles to the head of the document (placeholder - adapt to your actual framework)

// ... (Add code to dynamically create and render player cards using the fetched data and apply the styles)...