import { v4 as uuidv4 } from "uuid";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
// Note: pg is a CommonJS module, so we use require()
import pg from "pg";
const { Pool } = pg;
import session from "express-session";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

import * as schema from "@shared/schema";
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
  GamePhase, InsertGamePhase,
  GameSettings, InsertGameSettings,
  PriceUpdateEvent, InsertPriceUpdate,
  Notification, InsertNotification
} from "@shared/schema";
import { IStorage } from "./storage";

// Create Postgres connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const db = drizzle(pool, { schema });

// Create Postgres session store
const PostgresSessionStore = connectPg(session);

const scryptAsync = promisify(scrypt);

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
      tableName: 'session'
    });
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const users = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return users[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return users[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    // Hash the password if it's not already hashed
    if (!user.password.includes('.')) {
      user.password = await this.hashPassword(user.password);
    }
    
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, userId))
      .returning();
    
    return result[0];
  }

  // Team operations
  async getTeam(id: string): Promise<Team | undefined> {
    const teams = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    return teams[0];
  }

  async getTeamByUserId(userId: number): Promise<Team | undefined> {
    const teams = await db.select().from(schema.teams).where(eq(schema.teams.ownerId, userId)).limit(1);
    return teams[0];
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const teamId = uuidv4();
    const result = await db.insert(schema.teams).values({
      ...team,
      id: teamId
    }).returning();
    
    return result[0];
  }

  async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | undefined> {
    const result = await db.update(schema.teams)
      .set(updates)
      .where(eq(schema.teams.id, teamId))
      .returning();
    
    return result[0];
  }

  async updateTeamPoints(teamId: string, points: number): Promise<Team> {
    const team = await this.getTeam(teamId);
    if (!team) throw new Error("Team not found");
    
    const updatedTeam = await this.updateTeam(teamId, { points });
    if (!updatedTeam) throw new Error("Failed to update team points");
    
    return updatedTeam;
  }

  // Player operations
  async getPlayer(id: string): Promise<Player | undefined> {
    const players = await db.select().from(schema.players).where(eq(schema.players.id, id)).limit(1);
    return players[0];
  }

  async getPlayersByUserId(userId: number): Promise<Player[]> {
    return await db.select().from(schema.players).where(eq(schema.players.userId, userId));
  }

  async getPlayersByTeamId(teamId: string): Promise<Player[]> {
    return await db.select().from(schema.players).where(eq(schema.players.teamId, teamId));
  }

  async getMarketplacePlayers(): Promise<Player[]> {
    return await db.select().from(schema.players).where(isNull(schema.players.teamId));
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const playerId = uuidv4();
    const result = await db.insert(schema.players).values({
      ...player,
      id: playerId
    }).returning();
    
    return result[0];
  }

  async updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player | undefined> {
    const result = await db.update(schema.players)
      .set(updates)
      .where(eq(schema.players.id, playerId))
      .returning();
    
    return result[0];
  }

  async updatePlayerTeam(playerId: string, teamId: string): Promise<Player> {
    const player = await this.getPlayer(playerId);
    if (!player) throw new Error("Player not found");
    
    const updatedPlayer = await this.updatePlayer(playerId, { teamId });
    if (!updatedPlayer) throw new Error("Failed to update player team");
    
    return updatedPlayer;
  }

  // Team member operations
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return await db.select().from(schema.teamMembers).where(eq(schema.teamMembers.teamId, teamId));
  }

  async getTeamMembersByUserId(userId: number): Promise<TeamMember[]> {
    return await db.select().from(schema.teamMembers).where(eq(schema.teamMembers.userId, userId));
  }

  async addTeamMember(teamMember: InsertTeamMember): Promise<TeamMember> {
    const result = await db.insert(schema.teamMembers).values(teamMember).returning();
    return result[0];
  }

  async updateTeamMember(memberId: number, updates: Partial<TeamMember>): Promise<TeamMember | undefined> {
    const result = await db.update(schema.teamMembers)
      .set(updates)
      .where(eq(schema.teamMembers.id, memberId))
      .returning();
    
    return result[0];
  }

  async removeTeamMember(memberId: number): Promise<void> {
    await db.delete(schema.teamMembers).where(eq(schema.teamMembers.id, memberId));
  }

  // Tournament operations
  async getTournaments(): Promise<Tournament[]> {
    return await db.select().from(schema.tournaments);
  }

  async getTournament(id: string): Promise<Tournament | undefined> {
    const tournaments = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, id)).limit(1);
    return tournaments[0];
  }

  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const tournamentId = uuidv4();
    const result = await db.insert(schema.tournaments).values({
      ...tournament,
      id: tournamentId
    }).returning();
    
    return result[0];
  }

  async updateTournament(tournamentId: string, updates: Partial<Tournament>): Promise<Tournament | undefined> {
    const result = await db.update(schema.tournaments)
      .set(updates)
      .where(eq(schema.tournaments.id, tournamentId))
      .returning();
    
    return result[0];
  }

  async updateTournamentRegisteredTeams(tournamentId: string, count: number): Promise<Tournament> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) throw new Error("Tournament not found");
    
    const updatedTournament = await this.updateTournament(tournamentId, { registeredTeams: count });
    if (!updatedTournament) throw new Error("Failed to update tournament registered teams");
    
    return updatedTournament;
  }

  // Tournament registration operations
  async getTournamentRegistrations(tournamentId: string): Promise<TournamentRegistration[]> {
    return await db.select().from(schema.tournamentRegistrations)
      .where(eq(schema.tournamentRegistrations.tournamentId, tournamentId));
  }

  async getTeamTournamentRegistrations(teamId: string): Promise<TournamentRegistration[]> {
    return await db.select().from(schema.tournamentRegistrations)
      .where(eq(schema.tournamentRegistrations.teamId, teamId));
  }

  async registerTeamForTournament(registration: InsertTournamentRegistration): Promise<TournamentRegistration> {
    const result = await db.insert(schema.tournamentRegistrations).values(registration).returning();
    
    // Update the registered teams count
    const registrations = await this.getTournamentRegistrations(registration.tournamentId);
    await this.updateTournamentRegisteredTeams(registration.tournamentId, registrations.length);
    
    return result[0];
  }

  async unregisterTeamFromTournament(tournamentId: string, teamId: string): Promise<void> {
    await db.delete(schema.tournamentRegistrations)
      .where(
        and(
          eq(schema.tournamentRegistrations.tournamentId, tournamentId),
          eq(schema.tournamentRegistrations.teamId, teamId)
        )
      );
    
    // Update the registered teams count
    const registrations = await this.getTournamentRegistrations(tournamentId);
    await this.updateTournamentRegisteredTeams(tournamentId, registrations.length);
  }

  // Leaderboard
  async getTopTeams(limit: number): Promise<Team[]> {
    return await db.select().from(schema.teams)
      .orderBy(desc(schema.teams.points))
      .limit(limit);
  }

  // Stats sharing
  async createStatsShare(sharing: InsertStatsSharing): Promise<StatsSharing> {
    const shareId = uuidv4();
    const result = await db.insert(schema.statsSharing).values({
      ...sharing,
      id: shareId,
      shareCode: uuidv4().substring(0, 8) // Generate a short share code
    }).returning();
    
    return result[0];
  }

  async getStatsShareByCode(shareCode: string): Promise<StatsSharing | undefined> {
    const shares = await db.select().from(schema.statsSharing)
      .where(eq(schema.statsSharing.shareCode, shareCode))
      .limit(1);
      
    return shares[0];
  }

  async incrementShareAccessCount(shareId: string): Promise<StatsSharing | undefined> {
    const share = await db.select().from(schema.statsSharing)
      .where(eq(schema.statsSharing.id, shareId))
      .limit(1)
      .then(shares => shares[0]);
    
    if (!share) return undefined;
    
    // Increment access count
    const result = await db.update(schema.statsSharing)
      .set({ 
        accessCount: (share.accessCount ?? 0) + 1 
      })
      .where(eq(schema.statsSharing.id, shareId))
      .returning();
    
    return result[0];
  }

  async deactivateShare(shareId: string): Promise<void> {
    await db.update(schema.statsSharing)
      .set({ isActive: false })
      .where(eq(schema.statsSharing.id, shareId));
  }

  // Access requests
  async createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest> {
    const result = await db.insert(schema.accessRequests).values(request).returning();
    return result[0];
  }

  async getAccessRequestById(requestId: number): Promise<AccessRequest | undefined> {
    const requests = await db.select().from(schema.accessRequests)
      .where(eq(schema.accessRequests.id, requestId))
      .limit(1);
      
    return requests[0];
  }

  async getPendingAccessRequests(userId: number): Promise<AccessRequest[]> {
    return await db.select().from(schema.accessRequests)
      .where(
        and(
          eq(schema.accessRequests.targetType, "TEAM"),
          eq(schema.accessRequests.status, "PENDING")
        )
      );
    // Note: This will need to be filtered further in the application logic
    // based on team ownership which requires a join
  }

  async updateAccessRequestStatus(
    requestId: number, 
    status: string, 
    responseDate?: Date
  ): Promise<AccessRequest | undefined> {
    const result = await db.update(schema.accessRequests)
      .set({ 
        status, 
        responseAt: responseDate || new Date() 
      })
      .where(eq(schema.accessRequests.id, requestId))
      .returning();
    
    return result[0];
  }

  // Performance history
  async addPerformanceRecord(record: InsertPerformanceHistory): Promise<PerformanceHistory> {
    const result = await db.insert(schema.performanceHistory).values(record).returning();
    return result[0];
  }

  async getPlayerPerformanceHistory(playerId: string): Promise<PerformanceHistory[]> {
    return await db.select().from(schema.performanceHistory)
      .where(eq(schema.performanceHistory.playerId, playerId))
      .orderBy(desc(schema.performanceHistory.date));
  }

  async getTeamPerformanceHistory(teamId: string): Promise<PerformanceHistory[]> {
    // Get all players in the team
    const players = await this.getPlayersByTeamId(teamId);
    
    if (players.length === 0) return [];
    
    // Get performance history for all team players
    const playerIds = players.map(player => player.id);
    return await db.select().from(schema.performanceHistory)
      .where(sql`${schema.performanceHistory.playerId} IN ${playerIds}`)
      .orderBy(desc(schema.performanceHistory.date));
  }

  async getWeeklyPerformance(playerId: string, weekNumber: number): Promise<PerformanceHistory[]> {
    return await db.select().from(schema.performanceHistory)
      .where(
        and(
          eq(schema.performanceHistory.playerId, playerId),
          eq(schema.performanceHistory.weekNumber, weekNumber)
        )
      )
      .orderBy(desc(schema.performanceHistory.date));
  }

  // Game phases
  async getGamePhases(): Promise<GamePhase[]> {
    return await db.select().from(schema.gamePhases);
  }

  async getActiveGamePhase(): Promise<GamePhase | undefined> {
    const phases = await db.select().from(schema.gamePhases)
      .where(eq(schema.gamePhases.status, "ACTIVE"))
      .limit(1);
      
    return phases[0];
  }

  async getGamePhase(id: string): Promise<GamePhase | undefined> {
    const phases = await db.select().from(schema.gamePhases)
      .where(eq(schema.gamePhases.id, id))
      .limit(1);
      
    return phases[0];
  }

  async createGamePhase(phase: InsertGamePhase): Promise<GamePhase> {
    const phaseId = uuidv4();
    const result = await db.insert(schema.gamePhases).values({
      ...phase,
      id: phaseId
    }).returning();
    
    return result[0];
  }

  async updateGamePhase(phaseId: string, updates: Partial<GamePhase>): Promise<GamePhase | undefined> {
    const result = await db.update(schema.gamePhases)
      .set(updates)
      .where(eq(schema.gamePhases.id, phaseId))
      .returning();
    
    return result[0];
  }

  // Game settings
  async getGameSettings(): Promise<GameSettings | undefined> {
    const settings = await db.select().from(schema.gameSettings).limit(1);
    return settings[0];
  }

  async updateGameSettings(updates: Partial<GameSettings>): Promise<GameSettings | undefined> {
    const currentSettings = await this.getGameSettings();
    
    if (!currentSettings) {
      // If no settings exist, create a new one
      return this.createGameSettings(updates as InsertGameSettings);
    }
    
    const result = await db.update(schema.gameSettings)
      .set(updates)
      .where(eq(schema.gameSettings.id, currentSettings.id))
      .returning();
    
    return result[0];
  }

  async createGameSettings(settings: InsertGameSettings): Promise<GameSettings> {
    const settingsId = uuidv4();
    const result = await db.insert(schema.gameSettings).values({
      ...settings,
      id: settingsId
    }).returning();
    
    return result[0];
  }

  // Price updates
  async createPriceUpdate(update: InsertPriceUpdate): Promise<PriceUpdateEvent> {
    const updateId = uuidv4();
    const result = await db.insert(schema.priceUpdates).values({
      ...update,
      id: updateId
    }).returning();
    
    // Update the player's price
    await this.updatePlayer(update.playerId, { price: update.newPrice });
    
    return result[0];
  }

  async getPlayerPriceHistory(playerId: string): Promise<PriceUpdateEvent[]> {
    return await db.select().from(schema.priceUpdates)
      .where(eq(schema.priceUpdates.playerId, playerId))
      .orderBy(desc(schema.priceUpdates.updateTime));
  }

  async getRecentPriceUpdates(limit: number): Promise<PriceUpdateEvent[]> {
    return await db.select().from(schema.priceUpdates)
      .orderBy(desc(schema.priceUpdates.updateTime))
      .limit(limit);
  }

  async calculateNewPrice(playerId: string): Promise<number> {
    const player = await this.getPlayer(playerId);
    if (!player) throw new Error("Player not found");
    
    // In a real application, you would implement a more sophisticated price calculation
    // based on recent performance, market trends, etc.
    // For now, we'll do a simple random adjustment
    const priceChange = Math.floor(Math.random() * 50) - 25; // Random change between -25 and +25
    return Math.max(100, player.price + priceChange); // Ensure price doesn't go below 100
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const notificationId = uuidv4();
    const result = await db.insert(schema.notifications).values({
      ...notification,
      id: notificationId
    }).returning();
    
    return result[0];
  }

  async getUserNotifications(userId: number): Promise<Notification[]> {
    return await db.select().from(schema.notifications)
      .where(
        sql`${schema.notifications.userId} = ${userId} OR ${schema.notifications.userId} IS NULL`
      )
      .orderBy(desc(schema.notifications.createdAt));
  }

  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return await db.select().from(schema.notifications)
      .where(
        and(
          sql`(${schema.notifications.userId} = ${userId} OR ${schema.notifications.userId} IS NULL)`,
          isNull(schema.notifications.readAt)
        )
      )
      .orderBy(desc(schema.notifications.createdAt));
  }

  async markNotificationAsRead(notificationId: string): Promise<Notification | undefined> {
    const result = await db.update(schema.notifications)
      .set({ readAt: new Date() })
      .where(eq(schema.notifications.id, notificationId))
      .returning();
    
    return result[0];
  }

  async getBroadcastNotifications(): Promise<Notification[]> {
    return await db.select().from(schema.notifications)
      .where(isNull(schema.notifications.userId))
      .orderBy(desc(schema.notifications.createdAt));
  }
  
  // PayPal transaction operations
  async createPaypalTransaction(transaction: InsertPaypalTransaction): Promise<PaypalTransaction> {
    const transactionId = uuidv4();
    const result = await db.insert(schema.paypalTransactions).values({
      ...transaction,
      id: transactionId
    }).returning();
    
    return result[0];
  }
  
  async getPaypalTransactionById(transactionId: string): Promise<PaypalTransaction | undefined> {
    const transactions = await db.select().from(schema.paypalTransactions)
      .where(eq(schema.paypalTransactions.id, transactionId))
      .limit(1);
      
    return transactions[0];
  }
  
  async getUserPaypalTransactions(userId: number): Promise<PaypalTransaction[]> {
    return await db.select().from(schema.paypalTransactions)
      .where(eq(schema.paypalTransactions.userId, userId))
      .orderBy(desc(schema.paypalTransactions.createdAt));
  }
  
  async updatePaypalTransactionStatus(
    transactionId: string, 
    status: string, 
    completedAt?: Date,
    paypalResponse?: any
  ): Promise<PaypalTransaction | undefined> {
    const updates: Partial<PaypalTransaction> = { status };
    
    if (completedAt) {
      updates.completedAt = completedAt;
    }
    
    if (paypalResponse) {
      updates.paypalResponse = paypalResponse;
    }
    
    const result = await db.update(schema.paypalTransactions)
      .set(updates)
      .where(eq(schema.paypalTransactions.id, transactionId))
      .returning();
    
    return result[0];
  }
  
  // Money Pool operations
  async createMoneyPool(pool: InsertMoneyPool): Promise<MoneyPool> {
    const poolId = uuidv4();
    const result = await db.insert(schema.moneyPools).values({
      ...pool,
      id: poolId,
      totalAmount: pool.totalAmount ?? "0.00",
      currency: pool.currency ?? "USD",
      status: pool.status ?? "COLLECTING",
      distributed: pool.distributed ?? false,
      winnerId: pool.winnerId ?? null
    }).returning();
    
    return result[0];
  }
  
  async getMoneyPoolById(poolId: string): Promise<MoneyPool | undefined> {
    const pools = await db.select().from(schema.moneyPools)
      .where(eq(schema.moneyPools.id, poolId))
      .limit(1);
      
    return pools[0];
  }
  
  async getMoneyPoolByTournamentId(tournamentId: string): Promise<MoneyPool | undefined> {
    const pools = await db.select().from(schema.moneyPools)
      .where(eq(schema.moneyPools.tournamentId, tournamentId))
      .limit(1);
      
    return pools[0];
  }
  
  async updateMoneyPool(
    poolId: string, 
    updates: Partial<MoneyPool>
  ): Promise<MoneyPool | undefined> {
    const result = await db.update(schema.moneyPools)
      .set(updates)
      .where(eq(schema.moneyPools.id, poolId))
      .returning();
    
    return result[0];
  }
  
  async closeMoneyPool(poolId: string, winnerId?: number): Promise<MoneyPool | undefined> {
    const updates: Partial<MoneyPool> = {
      status: "CLOSED",
      closedAt: new Date()
    };
    
    if (winnerId) {
      updates.winnerId = winnerId;
    }
    
    const result = await db.update(schema.moneyPools)
      .set(updates)
      .where(eq(schema.moneyPools.id, poolId))
      .returning();
    
    return result[0];
  }
  
  // Money Pool Contributions
  async createMoneyPoolContribution(contribution: InsertMoneyPoolContribution): Promise<MoneyPoolContribution> {
    const contributionId = uuidv4();
    const result = await db.insert(schema.moneyPoolContributions).values({
      ...contribution,
      id: contributionId,
      status: contribution.status ?? "PENDING"
    }).returning();
    
    // If the contribution is already completed, update the pool total
    if (result[0].status === "COMPLETED") {
      const pool = await this.getMoneyPoolById(contribution.moneyPoolId);
      if (pool) {
        const currentAmount = parseFloat(pool.totalAmount.toString());
        const contributionAmount = parseFloat(contribution.amount.toString());
        await this.updateMoneyPool(pool.id, { 
          totalAmount: (currentAmount + contributionAmount).toFixed(2) 
        });
      }
    }
    
    return result[0];
  }
  
  async getMoneyPoolContributions(poolId: string): Promise<MoneyPoolContribution[]> {
    return await db.select().from(schema.moneyPoolContributions)
      .where(eq(schema.moneyPoolContributions.moneyPoolId, poolId));
  }
  
  async getUserContributions(userId: number): Promise<MoneyPoolContribution[]> {
    return await db.select().from(schema.moneyPoolContributions)
      .where(eq(schema.moneyPoolContributions.userId, userId));
  }
  
  async updateMoneyPoolContributionStatus(
    contributionId: string, 
    status: string, 
    transactionId?: string,
    completedAt?: Date
  ): Promise<MoneyPoolContribution | undefined> {
    // Get the current status to check if it's changing to COMPLETED
    const contributions = await db.select().from(schema.moneyPoolContributions)
      .where(eq(schema.moneyPoolContributions.id, contributionId))
      .limit(1);
    
    const contribution = contributions[0];
    if (!contribution) return undefined;
    
    const oldStatus = contribution.status;
    const updates: Partial<MoneyPoolContribution> = { status };
    
    if (transactionId) {
      updates.transactionId = transactionId;
    }
    
    if (completedAt) {
      updates.completedAt = completedAt;
    }
    
    const result = await db.update(schema.moneyPoolContributions)
      .set(updates)
      .where(eq(schema.moneyPoolContributions.id, contributionId))
      .returning();
    
    // If the status changed to COMPLETED, update the pool total
    if (oldStatus !== "COMPLETED" && status === "COMPLETED") {
      const pool = await this.getMoneyPoolById(contribution.moneyPoolId);
      if (pool) {
        const currentAmount = parseFloat(pool.totalAmount.toString());
        const contributionAmount = parseFloat(contribution.amount.toString());
        await this.updateMoneyPool(pool.id, { 
          totalAmount: (currentAmount + contributionAmount).toFixed(2) 
        });
      }
    }
    
    return result[0];
  }
}