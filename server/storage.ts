import { v4 as uuidv4 } from "uuid";
import session from "express-session";
import createMemoryStore from "memorystore";
// import { DatabaseStorage } from "./db-storage";
import { SupabaseDatabaseStorage } from "./supabase-db-storage";
import {
  User, InsertUser,
  Team, InsertTeam,
  Player, InsertPlayer,
  TeamMember, InsertTeamMember,
  Tournament, InsertTournament,
  TournamentRegistration, InsertTournamentRegistration,
  StatsSharing, InsertStatsSharing,
  AccessRequest, InsertAccessRequest,
  PerformanceHistory, InsertPerformanceHistory,
  GamePhase, GameSettings, PriceUpdateEvent, Notification,
  MoneyPool, InsertMoneyPool,
  MoneyPoolContribution, InsertMoneyPoolContribution,
  PaypalTransaction, InsertPaypalTransaction
} from "@shared/schema";

// For inserts
export interface InsertGamePhase {
  id?: string;
  name: string;
  description: string;
  startTime: Date | string;
  endTime: Date | string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  type: 'DRAFT' | 'REGULAR_SEASON' | 'PLAYOFFS' | 'TRANSFER_WINDOW' | 'OFF_SEASON';
  notificationSent: boolean;
}

export interface InsertGameSettings {
  id?: string;
  seasonName: string;
  seasonStartDate: Date | string;
  seasonEndDate: Date | string;
  startingCoins: number;
  transferWindowDuration: number;
  priceUpdateFrequency: number;
  minPlayerPrice: number;
  maxPlayerPrice: number;
  draftEnabled: boolean;
  draftDate: Date | string | null;
  draftDuration: number;
  currentPhaseId: string | null;
}

export interface InsertPriceUpdateEvent {
  id?: string;
  playerId: string;
  oldPrice: number;
  newPrice: number;
  updateTime: Date | string;
  reason: 'PERFORMANCE' | 'MARKET_DEMAND' | 'SCHEDULED_UPDATE' | 'ADMIN_ADJUSTMENT';
}

export interface InsertNotification {
  id?: string;
  userId: number | null;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' | 'TRANSFER_WINDOW' | 'PRICE_CHANGE' | 'GAME_PHASE';
  createdAt: Date | string;
  readAt: Date | string | null;
  relatedEntityId?: string;
  relatedEntityType?: 'PLAYER' | 'TEAM' | 'TOURNAMENT' | 'GAME_PHASE';
}

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: number, updates: Partial<User>): Promise<User | undefined>;

  // Team operations
  getTeam(id: string): Promise<Team | undefined>;
  getTeamByUserId(userId: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | undefined>;
  updateTeamPoints(teamId: string, points: number): Promise<Team>;

  // Player operations
  getPlayer(id: string): Promise<Player | undefined>;
  getPlayersByUserId(userId: number): Promise<Player[]>;
  getPlayersByTeamId(teamId: string): Promise<Player[]>;
  getMarketplacePlayers(): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player | undefined>;
  updatePlayerTeam(playerId: string, teamId: string): Promise<Player>;

  // Team member operations
  getTeamMembers(teamId: string): Promise<TeamMember[]>;
  getTeamMembersByUserId(userId: number): Promise<TeamMember[]>;
  addTeamMember(teamMember: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(memberId: number, updates: Partial<TeamMember>): Promise<TeamMember | undefined>;
  removeTeamMember(memberId: number): Promise<void>;

  // Tournament operations
  getTournaments(): Promise<Tournament[]>;
  getTournament(id: string): Promise<Tournament | undefined>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(tournamentId: string, updates: Partial<Tournament>): Promise<Tournament | undefined>;
  updateTournamentRegisteredTeams(tournamentId: string, count: number): Promise<Tournament>;

  // Tournament registration operations
  getTournamentRegistrations(tournamentId: string): Promise<TournamentRegistration[]>;
  getTeamTournamentRegistrations(teamId: string): Promise<TournamentRegistration[]>;
  registerTeamForTournament(registration: InsertTournamentRegistration): Promise<TournamentRegistration>;
  unregisterTeamFromTournament(tournamentId: string, teamId: string): Promise<void>;

  // Leaderboard
  getTopTeams(limit: number): Promise<Team[]>;

  // Stats sharing
  createStatsShare(sharing: InsertStatsSharing): Promise<StatsSharing>;
  getStatsShareByCode(shareCode: string): Promise<StatsSharing | undefined>;
  incrementShareAccessCount(shareId: string): Promise<StatsSharing | undefined>;
  deactivateShare(shareId: string): Promise<void>;

  // Access requests
  createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest>;
  getAccessRequestById(requestId: number): Promise<AccessRequest | undefined>;
  getPendingAccessRequests(userId: number): Promise<AccessRequest[]>;
  updateAccessRequestStatus(requestId: number, status: string, responseDate?: Date): Promise<AccessRequest | undefined>;

  // Performance history
  addPerformanceRecord(record: InsertPerformanceHistory): Promise<PerformanceHistory>;
  getPlayerPerformanceHistory(playerId: string): Promise<PerformanceHistory[]>;
  getTeamPerformanceHistory(teamId: string): Promise<PerformanceHistory[]>;
  getWeeklyPerformance(playerId: string, weekNumber: number): Promise<PerformanceHistory[]>;

  // Game phases
  getGamePhases(): Promise<GamePhase[]>;
  getActiveGamePhase(): Promise<GamePhase | undefined>;
  getGamePhase(id: string): Promise<GamePhase | undefined>;
  createGamePhase(phase: InsertGamePhase): Promise<GamePhase>;
  updateGamePhase(phaseId: string, updates: Partial<GamePhase>): Promise<GamePhase | undefined>;

  // Game settings
  getGameSettings(): Promise<GameSettings | undefined>;
  updateGameSettings(updates: Partial<GameSettings>): Promise<GameSettings | undefined>;
  createGameSettings(settings: InsertGameSettings): Promise<GameSettings>;

  // Price updates
  createPriceUpdate(update: InsertPriceUpdateEvent): Promise<PriceUpdateEvent>;
  getPlayerPriceHistory(playerId: string): Promise<PriceUpdateEvent[]>;
  getRecentPriceUpdates(limit: number): Promise<PriceUpdateEvent[]>;
  calculateNewPrice(playerId: string): Promise<number>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotifications(userId: number): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<Notification | undefined>;
  getBroadcastNotifications(): Promise<Notification[]>;

  // PayPal operations
  createPaypalTransaction(transaction: InsertPaypalTransaction): Promise<PaypalTransaction>;
  getPaypalTransactionById(transactionId: string): Promise<PaypalTransaction | undefined>;
  getUserPaypalTransactions(userId: number): Promise<PaypalTransaction[]>;
  updatePaypalTransactionStatus(
    transactionId: string,
    status: string,
    completedAt?: Date,
    paypalResponse?: any
  ): Promise<PaypalTransaction | undefined>;

  // Money Pool operations
  createMoneyPool(pool: InsertMoneyPool): Promise<MoneyPool>;
  getMoneyPoolById(poolId: string): Promise<MoneyPool | undefined>;
  getMoneyPoolByTournamentId(tournamentId: string): Promise<MoneyPool | undefined>;
  updateMoneyPool(
    poolId: string,
    updates: Partial<MoneyPool>
  ): Promise<MoneyPool | undefined>;
  closeMoneyPool(poolId: string, winnerId?: number): Promise<MoneyPool | undefined>;

  // Money Pool Contributions
  createMoneyPoolContribution(contribution: InsertMoneyPoolContribution): Promise<MoneyPoolContribution>;
  getMoneyPoolContributions(poolId: string): Promise<MoneyPoolContribution[]>;
  getUserContributions(userId: number): Promise<MoneyPoolContribution[]>;
  updateMoneyPoolContributionStatus(
    contributionId: string,
    status: string,
    transactionId?: string,
    completedAt?: Date
  ): Promise<MoneyPoolContribution | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private teams: Map<string, Team>;
  private players: Map<string, Player>;
  private teamMembers: Map<number, TeamMember>;
  private tournaments: Map<string, Tournament>;
  private tournamentRegistrations: Map<number, TournamentRegistration>;
  private statsShares: Map<string, StatsSharing>;
  private accessRequests: Map<number, AccessRequest>;
  private performanceHistory: Map<number, PerformanceHistory>;
  private gamePhases: Map<string, GamePhase>;
  private gameSettingsData: GameSettings | null;
  private priceUpdates: Map<string, PriceUpdateEvent>;
  private notifications: Map<string, Notification>;
  private moneyPools: Map<string, MoneyPool>;
  private moneyPoolContributions: Map<string, MoneyPoolContribution>;
  private paypalTransactions: Map<string, PaypalTransaction>;
  private currentUserId: number;
  private currentTeamMemberId: number;
  private currentRegistrationId: number;
  private currentAccessRequestId: number;
  private currentPerformanceHistoryId: number;

  // Session store for authentication
  public sessionStore: session.Store;

  constructor() {
    // Initialize memory store for sessions
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // Prune expired entries every 24h
    });

    this.users = new Map();
    this.teams = new Map();
    this.players = new Map();
    this.teamMembers = new Map();
    this.tournaments = new Map();
    this.tournamentRegistrations = new Map();
    this.statsShares = new Map();
    this.accessRequests = new Map();
    this.performanceHistory = new Map();
    this.gamePhases = new Map();
    this.gameSettingsData = null;
    this.priceUpdates = new Map();
    this.notifications = new Map();
    this.moneyPools = new Map();
    this.moneyPoolContributions = new Map();
    this.paypalTransactions = new Map();
    this.currentUserId = 1;
    this.currentTeamMemberId = 1;
    this.currentRegistrationId = 1;
    this.currentAccessRequestId = 1;
    this.currentPerformanceHistoryId = 1;

    // Initialize with sample data
    this.initSampleData();
  }

  private initSampleData() {
    // Create sample tournaments
    const tournament1: Tournament = {
      id: uuidv4(),
      name: "FNCS FINALS",
      date: "June 24, 2023",
      time: "8:00 PM EST",
      type: "MAJOR",
      prizePool: 1000000,
      registeredTeams: 234,
      maxTeams: 250,
      description: "The Fortnite Champion Series Finals",
      status: "UPCOMING"
    };

    const tournament2: Tournament = {
      id: uuidv4(),
      name: "CASH CUP",
      date: "June 26, 2023",
      time: "6:00 PM EST",
      type: "MINOR",
      prizePool: 50000,
      registeredTeams: 142,
      maxTeams: 200,
      description: "Weekly Cash Cup tournament",
      status: "UPCOMING"
    };

    this.tournaments.set(tournament1.id, tournament1);
    this.tournaments.set(tournament2.id, tournament2);

    // Create sample pro players
    const samplePlayers = [
      {
        name: "Bugha",
        team: "Sentinels",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/2/2b/Bugha.jpg",
        price: 1200,
        rarity: "LEGENDARY",
        role: "FRAGGER",
        points: 450,
        eliminations: 56,
        winRate: 15,
        kd: 4.2,
        accuracy: 92,
        buildSpeed: 99,
        clutchFactor: 96,
        consistency: 95,
        tournaments: 45,
        avgPlacement: 4,
        seasonTrend: "RISING"
      },
      {
        name: "Mongraal",
        team: "FaZe Clan",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/7/7e/Mongraal.jpg",
        price: 1100,
        rarity: "LEGENDARY",
        role: "FRAGGER",
        points: 430,
        eliminations: 62,
        winRate: 12,
        kd: 4.5,
        accuracy: 90,
        buildSpeed: 98,
        clutchFactor: 94,
        consistency: 88,
        tournaments: 42,
        avgPlacement: 5,
        seasonTrend: "STABLE"
      },
      {
        name: "Benjyfishy",
        team: "NRG",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/9/97/Benjyfishy.jpg",
        price: 1000,
        rarity: "EPIC",
        role: "IGL",
        points: 410,
        eliminations: 48,
        winRate: 18,
        kd: 3.8,
        accuracy: 94,
        buildSpeed: 95,
        clutchFactor: 93,
        consistency: 97,
        tournaments: 38,
        avgPlacement: 3,
        seasonTrend: "RISING"
      },
      {
        name: "Clix",
        team: "NRG",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/e/e1/Clix.jpg",
        price: 950,
        rarity: "EPIC",
        role: "FRAGGER",
        points: 400,
        eliminations: 58,
        winRate: 14,
        kd: 4.0,
        accuracy: 89,
        buildSpeed: 97,
        clutchFactor: 90,
        consistency: 85,
        tournaments: 36,
        avgPlacement: 6,
        seasonTrend: "STABLE"
      },
      {
        name: "Tfue",
        team: "FaZe Clan",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/5/5a/Tfue.jpg",
        price: 900,
        rarity: "EPIC",
        role: "FLEX",
        points: 380,
        eliminations: 52,
        winRate: 16,
        kd: 3.9,
        accuracy: 91,
        buildSpeed: 94,
        clutchFactor: 95,
        consistency: 92,
        tournaments: 34,
        avgPlacement: 5,
        seasonTrend: "STABLE"
      },
      {
        name: "Savage",
        team: "100 Thieves",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/8/82/Savage.jpg",
        price: 850,
        rarity: "RARE",
        role: "SUPPORT",
        points: 350,
        eliminations: 45,
        winRate: 13,
        kd: 3.6,
        accuracy: 88,
        buildSpeed: 92,
        clutchFactor: 86,
        consistency: 90,
        tournaments: 32,
        avgPlacement: 7,
        seasonTrend: "RISING"
      },
      {
        name: "Aqua",
        team: "Team Liquid",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/9/95/Aqua.jpg",
        price: 800,
        rarity: "RARE",
        role: "IGL",
        points: 330,
        eliminations: 42,
        winRate: 15,
        kd: 3.4,
        accuracy: 87,
        buildSpeed: 90,
        clutchFactor: 89,
        consistency: 93,
        tournaments: 30,
        avgPlacement: 6,
        seasonTrend: "STABLE"
      },
      {
        name: "Mitro",
        team: "Team Liquid",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/6/6e/Mitro.jpg",
        price: 750,
        rarity: "RARE",
        role: "SUPPORT",
        points: 320,
        eliminations: 40,
        winRate: 12,
        kd: 3.2,
        accuracy: 86,
        buildSpeed: 88,
        clutchFactor: 84,
        consistency: 87,
        tournaments: 28,
        avgPlacement: 8,
        seasonTrend: "FALLING"
      },
      {
        name: "Zayt",
        team: "NRG",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/a/a8/Zayt.jpg",
        price: 700,
        rarity: "UNCOMMON",
        role: "IGL",
        points: 300,
        eliminations: 38,
        winRate: 14,
        kd: 3.0,
        accuracy: 85,
        buildSpeed: 87,
        clutchFactor: 88,
        consistency: 91,
        tournaments: 26,
        avgPlacement: 7,
        seasonTrend: "STABLE"
      },
      {
        name: "Arkhram",
        team: "100 Thieves",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/b/b9/Arkhram.jpg",
        price: 650,
        rarity: "UNCOMMON",
        role: "FLEX",
        points: 280,
        eliminations: 36,
        winRate: 11,
        kd: 2.9,
        accuracy: 84,
        buildSpeed: 86,
        clutchFactor: 82,
        consistency: 85,
        tournaments: 24,
        avgPlacement: 9,
        seasonTrend: "RISING"
      },
      {
        name: "Edgey",
        team: "FaZe Clan",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/3/33/Edgey.jpg",
        price: 600,
        rarity: "UNCOMMON",
        role: "SUPPORT",
        points: 260,
        eliminations: 34,
        winRate: 10,
        kd: 2.7,
        accuracy: 83,
        buildSpeed: 85,
        clutchFactor: 80,
        consistency: 82,
        tournaments: 22,
        avgPlacement: 10,
        seasonTrend: "STABLE"
      },
      {
        name: "Khanada",
        team: "TSM",
        avatar: "https://static.wikia.nocookie.net/fortnite/images/c/c0/Khanada.jpg",
        price: 550,
        rarity: "COMMON",
        role: "FRAGGER",
        points: 240,
        eliminations: 38,
        winRate: 9,
        kd: 2.8,
        accuracy: 82,
        buildSpeed: 84,
        clutchFactor: 79,
        consistency: 80,
        tournaments: 20,
        avgPlacement: 11,
        seasonTrend: "RISING"
      }
    ];

    // Add pro players to marketplace
    samplePlayers.forEach(playerData => {
      const playerId = uuidv4();
      const now = new Date();

      const player: Player = {
        id: playerId,
        name: playerData.name,
        team: playerData.team,
        avatar: playerData.avatar,
        points: playerData.points,
        price: playerData.price,
        rarity: playerData.rarity,
        role: playerData.role,
        isTeamCaptain: null,
        teamId: null,
        userId: null,
        eliminations: playerData.eliminations,
        winRate: playerData.winRate,
        kd: playerData.kd,
        accuracy: playerData.accuracy,
        buildSpeed: playerData.buildSpeed,
        clutchFactor: playerData.clutchFactor,
        consistency: playerData.consistency,
        tournaments: playerData.tournaments,
        avgPlacement: playerData.avgPlacement,
        lastUpdatedAt: now,
        historicalPerformance: null,
        weeklyPoints: Math.floor(playerData.points / 4),
        monthlyPoints: Math.floor(playerData.points / 2),
        seasonPoints: playerData.points,
        seasonTrend: playerData.seasonTrend
      };

      this.players.set(playerId, player);
    });

    // Initialize a game season with phases
    this.createGameSettings({
      seasonName: "Season 1",
      seasonStartDate: new Date(),
      seasonEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      startingCoins: 5000, // Starting coins for new users
      transferWindowDuration: 48, // 48 hours
      priceUpdateFrequency: 24, // 24 hours
      minPlayerPrice: 100,
      maxPlayerPrice: 2000,
      draftEnabled: true,
      draftDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      draftDuration: 120, // 2 hours
      currentPhaseId: null
    });

    // Create game phases
    const phases = [
      {
        name: "Pre-Season",
        description: "Team creation and preparation phase before the draft",
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: "ACTIVE",
        type: "OFF_SEASON",
        notificationSent: true
      },
      {
        name: "Draft Phase",
        description: "Select your initial roster of players",
        startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        endTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), // 9 days from now
        status: "UPCOMING",
        type: "DRAFT",
        notificationSent: false
      },
      {
        name: "Regular Season Week 1",
        description: "First week of the regular season",
        startTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), // 9 days from now
        endTime: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000), // 16 days from now
        status: "UPCOMING",
        type: "REGULAR_SEASON",
        notificationSent: false
      }
    ];

    phases.forEach(async (phaseData, index) => {
      const phase = await this.createGamePhase(phaseData);
      if (index === 0 && this.gameSettingsData) {
        this.gameSettingsData.currentPhaseId = phase.id;
      }
    });

    // Create initial notifications
    const welcomeNotification: InsertNotification = {
      userId: null, // Broadcast to all users
      title: "Welcome to Fantasy Fortnite",
      message: "Welcome to the first season of Fantasy Fortnite! Build your team, compete in tournaments, and rise to the top of the leaderboards.",
      type: "INFO",
      createdAt: new Date(),
      readAt: null
    };

    this.createNotification(welcomeNotification);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      coins: insertUser.coins ?? 1000,
      teamId: insertUser.teamId ?? null
    };
    this.users.set(id, user);
    return user;
  }

  // Team operations
  async getTeam(id: string): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async getTeamByUserId(userId: number): Promise<Team | undefined> {
    return Array.from(this.teams.values()).find(
      (team) => team.ownerId === userId,
    );
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const id = uuidv4();
    const now = new Date();
    const team: Team = {
      ...insertTeam,
      id,
      createdAt: now,
      points: insertTeam.points ?? 0,
      rank: insertTeam.rank ?? 999
    };
    this.teams.set(id, team);
    return team;
  }

  async updateTeamPoints(teamId: string, points: number): Promise<Team> {
    const team = await this.getTeam(teamId);
    if (!team) throw new Error("Team not found");

    team.points = points;
    this.teams.set(teamId, team);

    // Update team rank (simple implementation for demo)
    const allTeams = Array.from(this.teams.values());
    allTeams.sort((a, b) => b.points - a.points);

    allTeams.forEach((t, index) => {
      t.rank = index + 1;
      this.teams.set(t.id, t);
    });

    return team;
  }

  // Player operations
  async getPlayer(id: string): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayersByUserId(userId: number): Promise<Player[]> {
    return Array.from(this.players.values()).filter(
      (player) => player.userId === userId,
    );
  }

  async getPlayersByTeamId(teamId: string): Promise<Player[]> {
    return Array.from(this.players.values()).filter(
      (player) => player.teamId === teamId,
    );
  }

  async getMarketplacePlayers(): Promise<Player[]> {
    return Array.from(this.players.values()).filter(
      (player) => !player.userId && !player.teamId,
    );
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = uuidv4();
    const now = new Date();
    const player: Player = {
      ...insertPlayer,
      id,
      lastUpdatedAt: now,
      points: insertPlayer.points ?? 0,
      teamId: insertPlayer.teamId ?? null,
      avatar: insertPlayer.avatar ?? null,
      userId: insertPlayer.userId ?? null,
      isTeamCaptain: insertPlayer.isTeamCaptain ?? null,
      eliminations: insertPlayer.eliminations ?? 0,
      winRate: insertPlayer.winRate ?? 0,
      kd: insertPlayer.kd ?? 0
    };
    this.players.set(id, player);
    return player;
  }

  async updatePlayerTeam(playerId: string, teamId: string): Promise<Player> {
    const player = await this.getPlayer(playerId);
    if (!player) throw new Error("Player not found");

    player.teamId = teamId;
    player.lastUpdatedAt = new Date();
    this.players.set(playerId, player);
    return player;
  }

  // Team member operations
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return Array.from(this.teamMembers.values()).filter(
      (member) => member.teamId === teamId,
    );
  }

  async getTeamMembersByUserId(userId: number): Promise<TeamMember[]> {
    return Array.from(this.teamMembers.values()).filter(
      (member) => member.userId === userId,
    );
  }

  async addTeamMember(insertTeamMember: InsertTeamMember): Promise<TeamMember> {
    const id = this.currentTeamMemberId++;
    const now = new Date();
    const teamMember: TeamMember = { ...insertTeamMember, id, joinedAt: now };
    this.teamMembers.set(id, teamMember);
    return teamMember;
  }

  // Tournament operations
  async getTournaments(): Promise<Tournament[]> {
    return Array.from(this.tournaments.values());
  }

  async getTournament(id: string): Promise<Tournament | undefined> {
    return this.tournaments.get(id);
  }

  async createTournament(insertTournament: InsertTournament): Promise<Tournament> {
    const id = uuidv4();
    const tournament: Tournament = {
      ...insertTournament,
      id,
      registeredTeams: insertTournament.registeredTeams ?? 0
    };
    this.tournaments.set(id, tournament);
    return tournament;
  }

  async updateTournamentRegisteredTeams(tournamentId: string, count: number): Promise<Tournament> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) throw new Error("Tournament not found");

    tournament.registeredTeams = count;
    this.tournaments.set(tournamentId, tournament);

    return tournament;
  }

  // Tournament registration operations
  async getTournamentRegistrations(tournamentId: string): Promise<TournamentRegistration[]> {
    return Array.from(this.tournamentRegistrations.values()).filter(
      (registration) => registration.tournamentId === tournamentId
    );
  }

  async registerTeamForTournament(registration: InsertTournamentRegistration): Promise<TournamentRegistration> {
    const id = this.currentRegistrationId++;
    const now = new Date();
    const tournamentRegistration: TournamentRegistration = {
      ...registration,
      id,
      status: registration.status ?? 'REGISTERED',
      registeredAt: registration.registeredAt ?? now
    };

    this.tournamentRegistrations.set(id, tournamentRegistration);
    return tournamentRegistration;
  }

  async unregisterTeamFromTournament(tournamentId: string, teamId: string): Promise<void> {
    const registrations = Array.from(this.tournamentRegistrations.entries());

    for (const [id, registration] of registrations) {
      if (registration.tournamentId === tournamentId && registration.teamId === teamId) {
        this.tournamentRegistrations.delete(id);
        break;
      }
    }
  }

  // Leaderboard
  async getTopTeams(limit: number): Promise<Team[]> {
    const allTeams = Array.from(this.teams.values());
    allTeams.sort((a, b) => b.points - a.points);
    return allTeams.slice(0, limit);
  }

  // Missing methods implementation

  // User operations
  async updateUser(userId: number, updates: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    Object.assign(user, updates);
    this.users.set(userId, user);
    return user;
  }

  // Team operations
  async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | undefined> {
    const team = await this.getTeam(teamId);
    if (!team) return undefined;

    Object.assign(team, updates);
    this.teams.set(teamId, team);
    return team;
  }

  // Player operations
  async updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player | undefined> {
    const player = await this.getPlayer(playerId);
    if (!player) return undefined;

    Object.assign(player, updates);
    player.lastUpdatedAt = new Date(); // Update timestamp
    this.players.set(playerId, player);
    return player;
  }

  // Team member operations
  async updateTeamMember(memberId: number, updates: Partial<TeamMember>): Promise<TeamMember | undefined> {
    const member = this.teamMembers.get(memberId);
    if (!member) return undefined;

    Object.assign(member, updates);
    this.teamMembers.set(memberId, member);
    return member;
  }

  async removeTeamMember(memberId: number): Promise<void> {
    this.teamMembers.delete(memberId);
  }

  // Tournament operations
  async updateTournament(tournamentId: string, updates: Partial<Tournament>): Promise<Tournament | undefined> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) return undefined;

    Object.assign(tournament, updates);
    this.tournaments.set(tournamentId, tournament);
    return tournament;
  }

  // Tournament registration operations
  async getTeamTournamentRegistrations(teamId: string): Promise<TournamentRegistration[]> {
    return Array.from(this.tournamentRegistrations.values()).filter(
      (registration) => registration.teamId === teamId
    );
  }

  // Stats sharing operations
  async createStatsShare(sharing: InsertStatsSharing): Promise<StatsSharing> {
    const id = uuidv4();
    const shareCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const statsShare: StatsSharing = {
      ...sharing,
      id,
      shareCode,
      createdAt: new Date(),
      accessCount: 0,
      isActive: true
    };

    this.statsShares.set(id, statsShare);
    return statsShare;
  }

  async getStatsShareByCode(shareCode: string): Promise<StatsSharing | undefined> {
    return Array.from(this.statsShares.values()).find(
      (share) => share.shareCode === shareCode && share.isActive
    );
  }

  async incrementShareAccessCount(shareId: string): Promise<StatsSharing | undefined> {
    const share = this.statsShares.get(shareId);
    if (!share) return undefined;

    share.accessCount += 1;

    // Check if max accesses reached and deactivate if needed
    if (share.maxAccesses && share.accessCount >= share.maxAccesses) {
      share.isActive = false;
    }

    this.statsShares.set(shareId, share);
    return share;
  }

  async deactivateShare(shareId: string): Promise<void> {
    const share = this.statsShares.get(shareId);
    if (!share) return;

    share.isActive = false;
    this.statsShares.set(shareId, share);
  }

  // Access requests operations
  async createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest> {
    const id = this.currentAccessRequestId++;
    const now = new Date();

    const accessRequest: AccessRequest = {
      ...request,
      id,
      requestedAt: now,
      status: request.status || 'PENDING',
      responseAt: null
    };

    this.accessRequests.set(id, accessRequest);
    return accessRequest;
  }

  async getAccessRequestById(requestId: number): Promise<AccessRequest | undefined> {
    return this.accessRequests.get(requestId);
  }

  async getPendingAccessRequests(userId: number): Promise<AccessRequest[]> {
    // Return requests that target a resource owned by the user
    const userTeam = await this.getTeamByUserId(userId);
    const userPlayers = await this.getPlayersByUserId(userId);

    return Array.from(this.accessRequests.values()).filter(request => {
      // Requests targeting user's team
      if (request.targetType === 'TEAM' && userTeam && request.targetId === userTeam.id) {
        return true;
      }

      // Requests targeting user's players
      if (request.targetType === 'PLAYER') {
        return userPlayers.some(player => player.id === request.targetId);
      }

      return false;
    }).filter(request => request.status === 'PENDING');
  }

  async updateAccessRequestStatus(requestId: number, status: string, responseDate?: Date): Promise<AccessRequest | undefined> {
    const request = await this.getAccessRequestById(requestId);
    if (!request) return undefined;

    request.status = status;
    request.responseAt = responseDate || new Date();

    this.accessRequests.set(requestId, request);
    return request;
  }

  // Performance history operations
  async addPerformanceRecord(record: InsertPerformanceHistory): Promise<PerformanceHistory> {
    const id = this.currentPerformanceHistoryId++;

    const performanceRecord: PerformanceHistory = {
      ...record,
      id
    };

    this.performanceHistory.set(id, performanceRecord);
    return performanceRecord;
  }

  async getPlayerPerformanceHistory(playerId: string): Promise<PerformanceHistory[]> {
    return Array.from(this.performanceHistory.values())
      .filter(record => record.playerId === playerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getTeamPerformanceHistory(teamId: string): Promise<PerformanceHistory[]> {
    const teamPlayers = await this.getPlayersByTeamId(teamId);
    const playerIds = teamPlayers.map(player => player.id);

    return Array.from(this.performanceHistory.values())
      .filter(record => playerIds.includes(record.playerId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getWeeklyPerformance(playerId: string, weekNumber: number): Promise<PerformanceHistory[]> {
    return Array.from(this.performanceHistory.values())
      .filter(record => record.playerId === playerId && record.weekNumber === weekNumber)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Game phase operations
  async getGamePhases(): Promise<GamePhase[]> {
    return Array.from(this.gamePhases.values());
  }

  async getActiveGamePhase(): Promise<GamePhase | undefined> {
    return Array.from(this.gamePhases.values()).find(
      phase => phase.status === 'ACTIVE'
    );
  }

  async getGamePhase(id: string): Promise<GamePhase | undefined> {
    return this.gamePhases.get(id);
  }

  async createGamePhase(phase: InsertGamePhase): Promise<GamePhase> {
    const id = uuidv4();
    const gamePhase: GamePhase = {
      ...phase,
      id
    };
    this.gamePhases.set(id, gamePhase);

    // If this is the first phase, make it the currentPhaseId in settings
    if (this.gamePhases.size === 1 && this.gameSettingsData) {
      this.gameSettingsData.currentPhaseId = id;
    }

    return gamePhase;
  }

  async updateGamePhase(phaseId: string, updates: Partial<GamePhase>): Promise<GamePhase | undefined> {
    const phase = await this.getGamePhase(phaseId);
    if (!phase) return undefined;

    Object.assign(phase, updates);
    this.gamePhases.set(phaseId, phase);
    return phase;
  }

  // Game settings operations
  async getGameSettings(): Promise<GameSettings | undefined> {
    return this.gameSettingsData;
  }

  async updateGameSettings(updates: Partial<GameSettings>): Promise<GameSettings | undefined> {
    if (!this.gameSettingsData) return undefined;

    Object.assign(this.gameSettingsData, updates);
    return this.gameSettingsData;
  }

  async createGameSettings(settings: InsertGameSettings): Promise<GameSettings> {
    const id = uuidv4();
    const gameSettings: GameSettings = {
      ...settings,
      id
    };
    this.gameSettingsData = gameSettings;
    return gameSettings;
  }

  // Price update operations
  async createPriceUpdate(update: InsertPriceUpdate): Promise<PriceUpdateEvent> {
    const id = uuidv4();
    const priceUpdate: PriceUpdateEvent = {
      ...update,
      id,
      updateTime: new Date()
    };
    this.priceUpdates.set(id, priceUpdate);

    // Also update the player's price
    const player = await this.getPlayer(update.playerId);
    if (player) {
      player.price = update.newPrice;

      // Set price change direction
      if (!player.priceChange) {
        player.priceChange = {
          amount: update.newPrice - update.oldPrice,
          percentage: ((update.newPrice - update.oldPrice) / update.oldPrice) * 100,
          direction: update.newPrice > update.oldPrice ? 'UP' : update.newPrice < update.oldPrice ? 'DOWN' : 'STABLE'
        };
      } else {
        player.priceChange = {
          amount: update.newPrice - update.oldPrice,
          percentage: ((update.newPrice - update.oldPrice) / update.oldPrice) * 100,
          direction: update.newPrice > update.oldPrice ? 'UP' : update.newPrice < update.oldPrice ? 'DOWN' : 'STABLE'
        };
      }

      this.players.set(player.id, player);
    }

    return priceUpdate;
  }

  async getPlayerPriceHistory(playerId: string): Promise<PriceUpdateEvent[]> {
    return Array.from(this.priceUpdates.values())
      .filter(update => update.playerId === playerId)
      .sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime());
  }

  async getRecentPriceUpdates(limit: number): Promise<PriceUpdateEvent[]> {
    const updates = Array.from(this.priceUpdates.values())
      .sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime());
    return updates.slice(0, limit);
  }

  async calculateNewPrice(playerId: string): Promise<number> {
    const player = await this.getPlayer(playerId);
    if (!player) throw new Error("Player not found");

    // Get recent performance to calculate new price
    const recentPerformance = await this.getPlayerPerformanceHistory(playerId);

    if (recentPerformance.length === 0) return player.price; // No change if no performance data

    const currentPrice = player.price;
    let newPrice = currentPrice;

    // Simple algorithm: each point increases value by 0.5%
    const mostRecentPerformance = recentPerformance[0];
    const points = mostRecentPerformance.points || 0;

    if (points > 0) {
      // Positive performance increases price
      newPrice = Math.min(currentPrice * (1 + (points * 0.005)), player.price * 1.3); // Max 30% increase
    } else if (points < 0) {
      // Negative performance decreases price
      newPrice = Math.max(currentPrice * (1 + (points * 0.005)), player.price * 0.7); // Max 30% decrease
    }

    // Round to nearest integer
    return Math.round(newPrice);
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = uuidv4();

    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: new Date()
    };

    this.notifications.set(id, newNotification);
    return newNotification;
  }

  async getUserNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification =>
        notification.userId === userId || notification.userId === null
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification =>
        (notification.userId === userId || notification.userId === null) &&
        !notification.readAt
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markNotificationAsRead(notificationId: string): Promise<Notification | undefined> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return undefined;

    notification.readAt = new Date();
    this.notifications.set(notificationId, notification);
    return notification;
  }

  async getBroadcastNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // PayPal transaction operations
  async createPaypalTransaction(transaction: InsertPaypalTransaction): Promise<PaypalTransaction> {
    const id = uuidv4();
    const now = new Date();
    const paypalTransaction: PaypalTransaction = {
      ...transaction,
      id,
      createdAt: now,
      completedAt: null
    };
    this.paypalTransactions.set(id, paypalTransaction);
    return paypalTransaction;
  }

  async getPaypalTransactionById(transactionId: string): Promise<PaypalTransaction | undefined> {
    return this.paypalTransactions.get(transactionId);
  }

  async getUserPaypalTransactions(userId: number): Promise<PaypalTransaction[]> {
    return Array.from(this.paypalTransactions.values()).filter(
      transaction => transaction.userId === userId
    ).sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async updatePaypalTransactionStatus(
    transactionId: string,
    status: string,
    completedAt?: Date,
    paypalResponse?: any
  ): Promise<PaypalTransaction | undefined> {
    const transaction = await this.getPaypalTransactionById(transactionId);
    if (!transaction) return undefined;

    transaction.status = status;

    if (completedAt) {
      transaction.completedAt = completedAt;
    }

    if (paypalResponse) {
      transaction.paypalResponse = paypalResponse;
    }

    this.paypalTransactions.set(transactionId, transaction);
    return transaction;
  }

  // Money Pool operations
  async createMoneyPool(pool: InsertMoneyPool): Promise<MoneyPool> {
    const id = uuidv4();
    const now = new Date();
    const moneyPool: MoneyPool = {
      ...pool,
      id,
      createdAt: now,
      closedAt: null,
      totalAmount: pool.totalAmount ?? "0.00",
      currency: pool.currency ?? "USD",
      status: pool.status ?? "COLLECTING",
      distributed: pool.distributed ?? false,
      winnerId: pool.winnerId ?? null
    };
    this.moneyPools.set(id, moneyPool);
    return moneyPool;
  }

  async getMoneyPoolById(poolId: string): Promise<MoneyPool | undefined> {
    return this.moneyPools.get(poolId);
  }

  async getMoneyPoolByTournamentId(tournamentId: string): Promise<MoneyPool | undefined> {
    return Array.from(this.moneyPools.values()).find(
      pool => pool.tournamentId === tournamentId
    );
  }

  async updateMoneyPool(
    poolId: string,
    updates: Partial<MoneyPool>
  ): Promise<MoneyPool | undefined> {
    const pool = await this.getMoneyPoolById(poolId);
    if (!pool) return undefined;

    const updatedPool: MoneyPool = {
      ...pool,
      ...updates
    };

    this.moneyPools.set(poolId, updatedPool);
    return updatedPool;
  }

  async closeMoneyPool(poolId: string, winnerId?: number): Promise<MoneyPool | undefined> {
    const pool = await this.getMoneyPoolById(poolId);
    if (!pool) return undefined;

    pool.status = "CLOSED";
    pool.closedAt = new Date();

    if (winnerId) {
      pool.winnerId = winnerId;
    }

    this.moneyPools.set(poolId, pool);
    return pool;
  }

  // Money Pool Contributions
  async createMoneyPoolContribution(contribution: InsertMoneyPoolContribution): Promise<MoneyPoolContribution> {
    const id = uuidv4();
    const now = new Date();
    const poolContribution: MoneyPoolContribution = {
      ...contribution,
      id,
      createdAt: now,
      completedAt: null,
      status: contribution.status ?? "PENDING"
    };
    this.moneyPoolContributions.set(id, poolContribution);

    // Update the total amount in the money pool if status is COMPLETED
    if (poolContribution.status === "COMPLETED") {
      const pool = await this.getMoneyPoolById(poolContribution.moneyPoolId);
      if (pool) {
        const currentAmount = parseFloat(pool.totalAmount.toString());
        const contributionAmount = parseFloat(contribution.amount.toString());
        pool.totalAmount = (currentAmount + contributionAmount).toFixed(2);
        this.moneyPools.set(pool.id, pool);
      }
    }

    return poolContribution;
  }

  async getMoneyPoolContributions(poolId: string): Promise<MoneyPoolContribution[]> {
    return Array.from(this.moneyPoolContributions.values()).filter(
      contribution => contribution.moneyPoolId === poolId
    );
  }

  async getUserContributions(userId: number): Promise<MoneyPoolContribution[]> {
    return Array.from(this.moneyPoolContributions.values()).filter(
      contribution => contribution.userId === userId
    );
  }

  async updateMoneyPoolContributionStatus(
    contributionId: string,
    status: string,
    transactionId?: string,
    completedAt?: Date
  ): Promise<MoneyPoolContribution | undefined> {
    const contribution = this.moneyPoolContributions.get(contributionId);
    if (!contribution) return undefined;

    const oldStatus = contribution.status;
    contribution.status = status;

    if (transactionId) {
      contribution.transactionId = transactionId;
    }

    if (completedAt) {
      contribution.completedAt = completedAt;
    }

    this.moneyPoolContributions.set(contributionId, contribution);

    // Update the money pool total if the status changed to COMPLETED
    if (oldStatus !== "COMPLETED" && status === "COMPLETED") {
      const pool = await this.getMoneyPoolById(contribution.moneyPoolId);
      if (pool) {
        const currentAmount = parseFloat(pool.totalAmount.toString());
        const contributionAmount = parseFloat(contribution.amount.toString());
        pool.totalAmount = (currentAmount + contributionAmount).toFixed(2);
        this.moneyPools.set(pool.id, pool);
      }
    }

    return contribution;
  }
}

// Use Supabase database storage for production
export const storage = new SupabaseDatabaseStorage();
