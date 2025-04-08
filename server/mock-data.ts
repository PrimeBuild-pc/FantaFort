import { v4 as uuidv4 } from 'uuid';

// Mock data for pro players
export const mockProPlayers = [
  {
    id: 'player1',
    name: 'Bugha',
    team: 'Sentinels',
    avatar: 'https://i.imgur.com/JVxGQy2.jpg',
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
    score: 95,
    placementScore: 90,
    prScore: 95,
    earningsScore: 98,
    rank: 1,
    previousRank: 2,
    price: 5000
  },
  {
    id: 'player2',
    name: 'Clix',
    team: 'NRG',
    avatar: 'https://i.imgur.com/8bXMmaP.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 5, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 2, date: '2023-02-20' }
    ],
    prPoints: 75000,
    earnings: 650000,
    eliminations: 420,
    winRate: 14,
    kd: 4.2,
    playerId: 'player2',
    playerName: 'Clix',
    score: 92,
    placementScore: 85,
    prScore: 90,
    earningsScore: 95,
    rank: 2,
    previousRank: 1,
    price: 4800
  },
  {
    id: 'player3',
    name: 'Mongraal',
    team: 'FaZe Clan',
    avatar: 'https://i.imgur.com/QvZJOyY.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 3, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 7, date: '2023-02-20' }
    ],
    prPoints: 70000,
    earnings: 600000,
    eliminations: 400,
    winRate: 13,
    kd: 4.0,
    playerId: 'player3',
    playerName: 'Mongraal',
    score: 90,
    placementScore: 88,
    prScore: 85,
    earningsScore: 92,
    rank: 3,
    previousRank: 3,
    price: 4600
  },
  {
    id: 'player4',
    name: 'Benjyfishy',
    team: 'NRG',
    avatar: 'https://i.imgur.com/L5Qfivb.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 2, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 5, date: '2023-02-20' }
    ],
    prPoints: 68000,
    earnings: 580000,
    eliminations: 380,
    winRate: 12.5,
    kd: 3.9,
    playerId: 'player4',
    playerName: 'Benjyfishy',
    score: 88,
    placementScore: 87,
    prScore: 82,
    earningsScore: 90,
    rank: 4,
    previousRank: 4,
    price: 4500
  },
  {
    id: 'player5',
    name: 'MrSavage',
    team: '100 Thieves',
    avatar: 'https://i.imgur.com/6YTMkjF.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 4, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 1, date: '2023-02-20' }
    ],
    prPoints: 65000,
    earnings: 550000,
    eliminations: 370,
    winRate: 12,
    kd: 3.8,
    playerId: 'player5',
    playerName: 'MrSavage',
    score: 87,
    placementScore: 86,
    prScore: 80,
    earningsScore: 88,
    rank: 5,
    previousRank: 5,
    price: 4400
  },
  {
    id: 'player6',
    name: 'Tfue',
    team: 'Free Agent',
    avatar: 'https://i.imgur.com/JHq9Qs7.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 8, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 6, date: '2023-02-20' }
    ],
    prPoints: 60000,
    earnings: 500000,
    eliminations: 350,
    winRate: 11.5,
    kd: 3.7,
    playerId: 'player6',
    playerName: 'Tfue',
    score: 85,
    placementScore: 84,
    prScore: 78,
    earningsScore: 85,
    rank: 6,
    previousRank: 6,
    price: 4300
  },
  {
    id: 'player7',
    name: 'Arkhram',
    team: '100 Thieves',
    avatar: 'https://i.imgur.com/QvZJOyY.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 6, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 4, date: '2023-02-20' }
    ],
    prPoints: 58000,
    earnings: 480000,
    eliminations: 340,
    winRate: 11,
    kd: 3.6,
    playerId: 'player7',
    playerName: 'Arkhram',
    score: 83,
    placementScore: 82,
    prScore: 76,
    earningsScore: 83,
    rank: 7,
    previousRank: 7,
    price: 4200
  },
  {
    id: 'player8',
    name: 'EpikWhale',
    team: 'NRG',
    avatar: 'https://i.imgur.com/L5Qfivb.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 7, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 8, date: '2023-02-20' }
    ],
    prPoints: 55000,
    earnings: 450000,
    eliminations: 330,
    winRate: 10.5,
    kd: 3.5,
    playerId: 'player8',
    playerName: 'EpikWhale',
    score: 81,
    placementScore: 80,
    prScore: 74,
    earningsScore: 81,
    rank: 8,
    previousRank: 8,
    price: 4100
  },
  {
    id: 'player9',
    name: 'Khanada',
    team: 'TSM',
    avatar: 'https://i.imgur.com/6YTMkjF.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 9, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 9, date: '2023-02-20' }
    ],
    prPoints: 52000,
    earnings: 420000,
    eliminations: 320,
    winRate: 10,
    kd: 3.4,
    playerId: 'player9',
    playerName: 'Khanada',
    score: 79,
    placementScore: 78,
    prScore: 72,
    earningsScore: 79,
    rank: 9,
    previousRank: 9,
    price: 4000
  },
  {
    id: 'player10',
    name: 'Dubs',
    team: 'FaZe Clan',
    avatar: 'https://i.imgur.com/JHq9Qs7.jpg',
    placements: [
      { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: 10, date: '2023-03-15' },
      { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: 10, date: '2023-02-20' }
    ],
    prPoints: 50000,
    earnings: 400000,
    eliminations: 310,
    winRate: 9.5,
    kd: 3.3,
    playerId: 'player10',
    playerName: 'Dubs',
    score: 77,
    placementScore: 76,
    prScore: 70,
    earningsScore: 77,
    rank: 10,
    previousRank: 10,
    price: 3900
  }
];

// Generate more mock players
export function generateMockPlayers(count: number = 100) {
  const players = [...mockProPlayers];
  
  const teams = ['FaZe Clan', 'NRG', 'TSM', '100 Thieves', 'Sentinels', 'Team Liquid', 'G2 Esports', 'Luminosity', 'Ghost Gaming', 'Free Agent'];
  const avatars = [
    'https://i.imgur.com/JVxGQy2.jpg',
    'https://i.imgur.com/8bXMmaP.jpg',
    'https://i.imgur.com/QvZJOyY.jpg',
    'https://i.imgur.com/L5Qfivb.jpg',
    'https://i.imgur.com/6YTMkjF.jpg',
    'https://i.imgur.com/JHq9Qs7.jpg'
  ];
  
  for (let i = players.length; i < count; i++) {
    const id = `player${i + 1}`;
    const name = `ProPlayer${i + 1}`;
    const team = teams[Math.floor(Math.random() * teams.length)];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];
    const prPoints = Math.floor(Math.random() * 50000) + 10000;
    const earnings = Math.floor(Math.random() * 300000) + 50000;
    const eliminations = Math.floor(Math.random() * 300) + 100;
    const winRate = Math.floor(Math.random() * 10) + 1;
    const kd = (Math.random() * 3) + 1;
    const score = Math.floor(Math.random() * 20) + 60;
    const rank = i + 1;
    const previousRank = Math.min(500, Math.max(1, rank + (Math.floor(Math.random() * 5) - 2)));
    const price = Math.floor(Math.random() * 2000) + 2000;
    
    players.push({
      id,
      name,
      team,
      avatar,
      placements: [
        { tournamentId: 't1', tournamentName: 'FNCS Chapter 4 Season 1', placement: Math.floor(Math.random() * 50) + 1, date: '2023-03-15' },
        { tournamentId: 't2', tournamentName: 'Dreamhack Open', placement: Math.floor(Math.random() * 50) + 1, date: '2023-02-20' }
      ],
      prPoints,
      earnings,
      eliminations,
      winRate,
      kd,
      playerId: id,
      playerName: name,
      score,
      placementScore: score - 2,
      prScore: score - 5,
      earningsScore: score - 3,
      rank,
      previousRank,
      price
    });
  }
  
  return players;
}

// Mock data for tournaments
export const mockTournaments = [
  {
    id: 'tournament1',
    name: 'FNCS Chapter 4 Season 1',
    startDate: '2023-06-01',
    endDate: '2023-06-15',
    status: 'UPCOMING',
    description: 'The Fortnite Champion Series for Chapter 4 Season 1',
    prizePool: 1000000,
    registrationOpen: true,
    maxTeams: 100,
    registeredTeams: 45,
    format: 'Solo',
    rules: 'Standard FNCS rules apply'
  },
  {
    id: 'tournament2',
    name: 'Dreamhack Open',
    startDate: '2023-07-01',
    endDate: '2023-07-10',
    status: 'UPCOMING',
    description: 'Dreamhack Open Fortnite Tournament',
    prizePool: 500000,
    registrationOpen: true,
    maxTeams: 200,
    registeredTeams: 120,
    format: 'Duos',
    rules: 'Standard Dreamhack rules apply'
  },
  {
    id: 'tournament3',
    name: 'Cash Cup',
    startDate: '2023-05-15',
    endDate: '2023-05-16',
    status: 'COMPLETED',
    description: 'Weekly Cash Cup Tournament',
    prizePool: 100000,
    registrationOpen: false,
    maxTeams: 1000,
    registeredTeams: 950,
    format: 'Trios',
    rules: 'Standard Cash Cup rules apply'
  }
];

// Mock data for player stats
export const mockPlayerStats = {
  accountId: 'player1',
  platformId: 1,
  platformName: 'epic',
  platformNameLong: 'Epic Games',
  displayName: 'Bugha',
  lifetimeStats: {
    wins: 1500,
    matchesPlayed: 10000,
    winRate: 15,
    kills: 45000,
    kd: 4.5,
    top10: 3500,
    top25: 5000
  },
  stats: {
    all: {
      overall: {
        score: 2500000,
        scorePerMin: 350,
        scorePerMatch: 250,
        wins: 1500,
        top3: 2500,
        top5: 3000,
        top6: 3200,
        top10: 3500,
        top12: 3700,
        top25: 5000,
        kills: 45000,
        killsPerMin: 0.75,
        killsPerMatch: 4.5,
        deaths: 8500,
        kd: 4.5,
        matches: 10000,
        winRate: 15,
        minutesPlayed: 60000,
        playersOutlived: 950000
      }
    }
  }
};

// Generate a mock player stats object
export function generateMockPlayerStats(playerId: string, playerName: string) {
  const wins = Math.floor(Math.random() * 1000) + 500;
  const matchesPlayed = Math.floor(Math.random() * 8000) + 2000;
  const winRate = (wins / matchesPlayed) * 100;
  const kills = Math.floor(Math.random() * 30000) + 15000;
  const deaths = matchesPlayed - wins;
  const kd = kills / deaths;
  const top10 = Math.floor(Math.random() * 2000) + 1500;
  const top25 = Math.floor(Math.random() * 3000) + 2000;
  
  return {
    accountId: playerId,
    platformId: 1,
    platformName: 'epic',
    platformNameLong: 'Epic Games',
    displayName: playerName,
    lifetimeStats: {
      wins,
      matchesPlayed,
      winRate,
      kills,
      kd,
      top10,
      top25
    },
    stats: {
      all: {
        overall: {
          score: Math.floor(Math.random() * 2000000) + 500000,
          scorePerMin: Math.floor(Math.random() * 300) + 100,
          scorePerMatch: Math.floor(Math.random() * 200) + 50,
          wins,
          top3: Math.floor(Math.random() * 1500) + 1000,
          top5: Math.floor(Math.random() * 2000) + 1500,
          top6: Math.floor(Math.random() * 2200) + 1700,
          top10,
          top12: Math.floor(Math.random() * 2500) + 2000,
          top25,
          kills,
          killsPerMin: (Math.random() * 0.5) + 0.25,
          killsPerMatch: (Math.random() * 3) + 1.5,
          deaths,
          kd,
          matches: matchesPlayed,
          winRate,
          minutesPlayed: Math.floor(Math.random() * 50000) + 10000,
          playersOutlived: Math.floor(Math.random() * 800000) + 150000
        }
      }
    }
  };
}
