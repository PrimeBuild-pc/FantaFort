import { v4 as uuidv4 } from "uuid";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { supabase, supabaseAdmin } from "./supabase";
import { db } from "./supabase-db";
import { supabaseStorage } from "./supabase-storage";

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
  Notification, InsertNotification,
  MoneyPool, InsertMoneyPool,
  MoneyPoolContribution, InsertMoneyPoolContribution,
  PaypalTransaction, InsertPaypalTransaction
} from "@shared/schema";

// Promisify scrypt
const scryptAsync = promisify(scrypt);

// Create PostgreSQL session store
const PgStore = connectPg(session);

// Create session store
const sessionStore = new PgStore({
  conString: process.env.SUPABASE_POSTGRES_URL ||
    `postgres://postgres.nxrqxozgbjiegjqgjypa:${process.env.SUPABASE_SERVICE_KEY}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  tableName: 'sessions',
  createTableIfMissing: true,
});

/**
 * Database storage implementation using Supabase
 */
export class SupabaseDatabaseStorage {
  // Expose session store for auth
  public sessionStore = sessionStore;
  /**
   * User Operations
   */

  // Create a new user
  async createUser(userData: InsertUser): Promise<User> {
    // Hash the password
    const salt = randomBytes(16).toString("hex");
    const passwordHash = await this.hashPassword(userData.password, salt);

    // Insert user into database
    const [user] = await db.insert(schema.users)
      .values({
        ...userData,
        password: `${passwordHash}:${salt}`,
        coins: userData.coins || 1000,
        isPublicProfile: userData.isPublicProfile || false
      })
      .returning();

    return user;
  }

  // Get user by ID
  async getUserById(userId: number): Promise<User | null> {
    const users = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return users.length > 0 ? users[0] : null;
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<User | null> {
    const users = await db.select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    return users.length > 0 ? users[0] : null;
  }

  // Get user (alias for getUserById for compatibility)
  async getUser(userId: number): Promise<User | null> {
    return this.getUserById(userId);
  }

  // Verify user password
  async verifyPassword(user: User, password: string): Promise<boolean> {
    const [hashedPassword, salt] = user.password.split(":");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = await scryptAsync(password, salt, 64) as Buffer;

    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  }

  // Hash a password
  private async hashPassword(password: string, salt: string): Promise<string> {
    const hashedPasswordBuf = await scryptAsync(password, salt, 64) as Buffer;
    return hashedPasswordBuf.toString("hex");
  }

  /**
   * Team Operations
   */

  // Create a new team
  async createTeam(teamData: InsertTeam): Promise<Team> {
    // Insert team into database
    const [team] = await db.insert(schema.teams)
      .values({
        ...teamData,
        id: teamData.id || uuidv4(),
        createdAt: teamData.createdAt || new Date(),
        rank: teamData.rank || 999,
        points: teamData.points || 0,
        isPublic: teamData.isPublic !== undefined ? teamData.isPublic : true
      })
      .returning();

    // Add owner as team member
    await db.insert(schema.teamMembers)
      .values({
        teamId: team.id,
        userId: teamData.ownerId,
        joinedAt: new Date(),
        role: "OWNER"
      });

    // Update user with team ID
    await db.update(schema.users)
      .set({ teamId: team.id })
      .where(eq(schema.users.id, teamData.ownerId));

    return team;
  }

  // Get team by ID
  async getTeamById(teamId: string): Promise<Team | null> {
    const teams = await db.select()
      .from(schema.teams)
      .where(eq(schema.teams.id, teamId))
      .limit(1);

    return teams.length > 0 ? teams[0] : null;
  }

  // Get team by user ID
  async getTeamByUserId(userId: number): Promise<Team | null> {
    // First get the user to find their team ID
    const users = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (users.length === 0 || !users[0].teamId) {
      return null;
    }

    // Get the team
    return this.getTeamById(users[0].teamId);
  }

  // Get team (alias for getTeamById for compatibility)
  async getTeam(teamId: string): Promise<Team | null> {
    return this.getTeamById(teamId);
  }

  // Get team members
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return db.select()
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.teamId, teamId));
  }

  // Add team member
  async addTeamMember(teamMembership: InsertTeamMember): Promise<TeamMember> {
    const [teamMember] = await db.insert(schema.teamMembers)
      .values({
        ...teamMembership,
        joinedAt: teamMembership.joinedAt || new Date()
      })
      .returning();

    return teamMember;
  }

  /**
   * Player Operations
   */

  // Get players by team ID
  async getPlayersByTeamId(teamId: string): Promise<Player[]> {
    return db.select()
      .from(schema.players)
      .where(eq(schema.players.teamId, teamId));
  }

  // Get players by user ID
  async getPlayersByUserId(userId: number): Promise<Player[]> {
    return db.select()
      .from(schema.players)
      .where(eq(schema.players.userId, userId));
  }

  // Get player by ID
  async getPlayer(playerId: string): Promise<Player | null> {
    const players = await db.select()
      .from(schema.players)
      .where(eq(schema.players.id, playerId))
      .limit(1);

    return players.length > 0 ? players[0] : null;
  }

  // Add player to team
  async addPlayerToTeam(playerId: string, teamId: string): Promise<Player | null> {
    const [player] = await db.update(schema.players)
      .set({ teamId })
      .where(eq(schema.players.id, playerId))
      .returning();

    return player || null;
  }

  // Update player team
  async updatePlayerTeam(playerId: string, teamId: string | null): Promise<Player | null> {
    const [player] = await db.update(schema.players)
      .set({ teamId })
      .where(eq(schema.players.id, playerId))
      .returning();

    return player || null;
  }

  // Create player
  async createPlayer(playerData: InsertPlayer): Promise<Player> {
    const [player] = await db.insert(schema.players)
      .values({
        ...playerData,
        id: playerData.id || uuidv4(),
        lastUpdatedAt: playerData.lastUpdatedAt || new Date(),
        points: playerData.points || 0,
        price: playerData.price || 100,
        rarity: playerData.rarity || 'COMMON',
        role: playerData.role || 'FLEX',
        eliminations: playerData.eliminations || 0,
        winRate: playerData.winRate || 0,
        kd: playerData.kd || 0
      })
      .returning();

    return player;
  }

  // Get marketplace players
  async getMarketplacePlayers(): Promise<Player[]> {
    return db.select()
      .from(schema.players)
      .where(isNull(schema.players.teamId))
      .orderBy(schema.players.price);
  }

  // Get player price history
  async getPlayerPriceHistory(playerId: string): Promise<PriceUpdateEvent[]> {
    return db.select()
      .from(schema.priceUpdates)
      .where(eq(schema.priceUpdates.playerId, playerId))
      .orderBy(desc(schema.priceUpdates.timestamp));
  }

  // Get player performance history
  async getPlayerPerformanceHistory(playerId: string): Promise<PerformanceHistory[]> {
    return db.select()
      .from(schema.performanceHistory)
      .where(eq(schema.performanceHistory.playerId, playerId))
      .orderBy(desc(schema.performanceHistory.date));
  }

  /**
   * Tournament Operations
   */

  // Get all tournaments
  async getTournaments(): Promise<Tournament[]> {
    return db.select()
      .from(schema.tournaments)
      .orderBy(schema.tournaments.date);
  }

  // Get tournament by ID
  async getTournamentById(tournamentId: string): Promise<Tournament | null> {
    const tournaments = await db.select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, tournamentId))
      .limit(1);

    return tournaments.length > 0 ? tournaments[0] : null;
  }

  // Get tournament (alias for getTournamentById for compatibility)
  async getTournament(tournamentId: string): Promise<Tournament | null> {
    return this.getTournamentById(tournamentId);
  }

  // Get tournament registrations
  async getTournamentRegistrations(tournamentId: string): Promise<TournamentRegistration[]> {
    return db.select()
      .from(schema.tournamentRegistrations)
      .where(eq(schema.tournamentRegistrations.tournamentId, tournamentId));
  }

  // Register team for tournament
  async registerTeamForTournament(registration: InsertTournamentRegistration): Promise<TournamentRegistration> {
    const [tournamentRegistration] = await db.insert(schema.tournamentRegistrations)
      .values({
        ...registration,
        registeredAt: registration.registeredAt || new Date()
      })
      .returning();

    return tournamentRegistration;
  }

  // Unregister team from tournament
  async unregisterTeamFromTournament(teamId: string, tournamentId: string): Promise<boolean> {
    const result = await db.delete(schema.tournamentRegistrations)
      .where(
        and(
          eq(schema.tournamentRegistrations.teamId, teamId),
          eq(schema.tournamentRegistrations.tournamentId, tournamentId)
        )
      );

    return true;
  }

  // Update tournament registered teams count
  async updateTournamentRegisteredTeams(tournamentId: string, count: number): Promise<Tournament | null> {
    const [tournament] = await db.update(schema.tournaments)
      .set({ registeredTeams: count })
      .where(eq(schema.tournaments.id, tournamentId))
      .returning();

    return tournament || null;
  }

  /**
   * Stats Sharing Operations
   */

  // Create stats share
  async createStatsShare(shareData: InsertStatsSharing): Promise<StatsSharing> {
    const [share] = await db.insert(schema.statsSharing)
      .values({
        ...shareData,
        id: shareData.id || uuidv4(),
        shareCode: shareData.shareCode || uuidv4().substring(0, 8),
        createdAt: shareData.createdAt || new Date(),
        isActive: shareData.isActive !== undefined ? shareData.isActive : true,
        accessCount: shareData.accessCount || 0
      })
      .returning();

    return share;
  }

  // Get stats share by code
  async getStatsShareByCode(shareCode: string): Promise<StatsSharing | null> {
    const shares = await db.select()
      .from(schema.statsSharing)
      .where(eq(schema.statsSharing.shareCode, shareCode))
      .limit(1);

    return shares.length > 0 ? shares[0] : null;
  }

  // Increment share access count
  async incrementShareAccessCount(shareId: string): Promise<StatsSharing | null> {
    const share = await this.getStatsShareById(shareId);

    if (!share) {
      return null;
    }

    const [updatedShare] = await db.update(schema.statsSharing)
      .set({ accessCount: (share.accessCount || 0) + 1 })
      .where(eq(schema.statsSharing.id, shareId))
      .returning();

    return updatedShare || null;
  }

  // Get stats share by ID
  async getStatsShareById(shareId: string): Promise<StatsSharing | null> {
    const shares = await db.select()
      .from(schema.statsSharing)
      .where(eq(schema.statsSharing.id, shareId))
      .limit(1);

    return shares.length > 0 ? shares[0] : null;
  }

  // Deactivate share
  async deactivateShare(shareId: string): Promise<StatsSharing | null> {
    const [share] = await db.update(schema.statsSharing)
      .set({ isActive: false })
      .where(eq(schema.statsSharing.id, shareId))
      .returning();

    return share || null;
  }

  /**
   * Access Request Operations
   */

  // Create access request
  async createAccessRequest(requestData: InsertAccessRequest): Promise<AccessRequest> {
    const [request] = await db.insert(schema.accessRequests)
      .values({
        ...requestData,
        requestedAt: requestData.requestedAt || new Date(),
        status: requestData.status || 'PENDING',
        responseAt: null
      })
      .returning();

    return request;
  }

  // Get pending access requests
  async getPendingAccessRequests(targetId: string, targetType: string): Promise<AccessRequest[]> {
    return db.select()
      .from(schema.accessRequests)
      .where(
        and(
          eq(schema.accessRequests.targetId, targetId),
          eq(schema.accessRequests.targetType, targetType),
          eq(schema.accessRequests.status, 'PENDING')
        )
      );
  }

  // Update access request status
  async updateAccessRequestStatus(requestId: number, status: string): Promise<AccessRequest | null> {
    const [request] = await db.update(schema.accessRequests)
      .set({
        status,
        responseAt: new Date()
      })
      .where(eq(schema.accessRequests.id, requestId))
      .returning();

    return request || null;
  }

  /**
   * Performance History Operations
   */

  // Add performance record
  async addPerformanceRecord(performanceData: InsertPerformanceHistory): Promise<PerformanceHistory> {
    const [record] = await db.insert(schema.performanceHistory)
      .values({
        ...performanceData,
        date: performanceData.date || new Date(),
        points: performanceData.points || 0
      })
      .returning();

    return record;
  }

  // Get team performance history
  async getTeamPerformanceHistory(teamId: string): Promise<any[]> {
    // This would typically join player performance records for all players in the team
    // For simplicity, we'll return an empty array for now
    return [];
  }

  // Get weekly performance
  async getWeeklyPerformance(weekNumber: number): Promise<any[]> {
    // This would typically aggregate performance records by week
    // For simplicity, we'll return an empty array for now
    return [];
  }

  /**
   * Game Phase Operations
   */

  // Get game phases
  async getGamePhases(): Promise<GamePhase[]> {
    return db.select()
      .from(schema.gamePhases)
      .orderBy(schema.gamePhases.startTime);
  }

  // Get active game phase
  async getActiveGamePhase(): Promise<GamePhase | null> {
    const now = new Date();

    const phases = await db.select()
      .from(schema.gamePhases)
      .where(
        and(
          sql`${schema.gamePhases.startTime} <= ${now}`,
          sql`${schema.gamePhases.endTime} >= ${now}`
        )
      )
      .limit(1);

    return phases.length > 0 ? phases[0] : null;
  }

  // Get game phase by ID
  async getGamePhase(phaseId: string): Promise<GamePhase | null> {
    const phases = await db.select()
      .from(schema.gamePhases)
      .where(eq(schema.gamePhases.id, phaseId))
      .limit(1);

    return phases.length > 0 ? phases[0] : null;
  }

  // Create game phase
  async createGamePhase(phaseData: InsertGamePhase): Promise<GamePhase> {
    const [phase] = await db.insert(schema.gamePhases)
      .values({
        ...phaseData,
        id: phaseData.id || uuidv4(),
        notificationSent: phaseData.notificationSent || false
      })
      .returning();

    return phase;
  }

  // Update game phase
  async updateGamePhase(phaseId: string, phaseData: Partial<GamePhase>): Promise<GamePhase | null> {
    const [phase] = await db.update(schema.gamePhases)
      .set(phaseData)
      .where(eq(schema.gamePhases.id, phaseId))
      .returning();

    return phase || null;
  }

  /**
   * Game Settings Operations
   */

  // Get game settings
  async getGameSettings(): Promise<GameSettings | null> {
    const settings = await db.select()
      .from(schema.gameSettings)
      .limit(1);

    return settings.length > 0 ? settings[0] : null;
  }

  // Create game settings
  async createGameSettings(settingsData: InsertGameSettings): Promise<GameSettings> {
    const [settings] = await db.insert(schema.gameSettings)
      .values({
        ...settingsData,
        id: settingsData.id || uuidv4()
      })
      .returning();

    return settings;
  }

  // Update game settings
  async updateGameSettings(settingsId: string, settingsData: Partial<GameSettings>): Promise<GameSettings | null> {
    const [settings] = await db.update(schema.gameSettings)
      .set(settingsData)
      .where(eq(schema.gameSettings.id, settingsId))
      .returning();

    return settings || null;
  }

  /**
   * Notification Operations
   */

  // Create notification
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(schema.notifications)
      .values({
        ...notificationData,
        id: notificationData.id || uuidv4(),
        createdAt: notificationData.createdAt || new Date(),
        readAt: null
      })
      .returning();

    return notification;
  }

  // Get user notifications
  async getUserNotifications(userId: number): Promise<Notification[]> {
    return db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt));
  }

  // Get unread notifications
  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return db.select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          isNull(schema.notifications.readAt)
        )
      )
      .orderBy(desc(schema.notifications.createdAt));
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<Notification | null> {
    const [notification] = await db.update(schema.notifications)
      .set({ readAt: new Date() })
      .where(eq(schema.notifications.id, notificationId))
      .returning();

    return notification || null;
  }

  /**
   * Price Update Operations
   */

  // Create price update
  async createPriceUpdate(updateData: InsertPriceUpdate): Promise<PriceUpdateEvent> {
    const [update] = await db.insert(schema.priceUpdates)
      .values({
        ...updateData,
        id: updateData.id || uuidv4(),
        timestamp: updateData.timestamp || new Date()
      })
      .returning();

    return update;
  }

  // Get recent price updates
  async getRecentPriceUpdates(limit: number = 10): Promise<PriceUpdateEvent[]> {
    return db.select()
      .from(schema.priceUpdates)
      .orderBy(desc(schema.priceUpdates.timestamp))
      .limit(limit);
  }

  /**
   * PayPal Operations
   */

  // Create a PayPal transaction
  async createPayPalTransaction(transactionData: InsertPaypalTransaction): Promise<PaypalTransaction> {
    const [transaction] = await db.insert(schema.paypalTransactions)
      .values({
        ...transactionData,
        id: transactionData.id || uuidv4(),
        createdAt: transactionData.createdAt || new Date()
      })
      .returning();

    return transaction;
  }

  // Update PayPal transaction status
  async updatePayPalTransactionStatus(
    transactionId: string,
    status: string,
    completedAt?: Date
  ): Promise<PaypalTransaction | null> {
    const updateData: any = { status };
    if (completedAt) {
      updateData.completedAt = completedAt;
    }

    const [transaction] = await db.update(schema.paypalTransactions)
      .set(updateData)
      .where(eq(schema.paypalTransactions.id, transactionId))
      .returning();

    return transaction || null;
  }

  /**
   * Money Pool Operations
   */

  // Create a money pool for a tournament
  async createMoneyPool(poolData: InsertMoneyPool): Promise<MoneyPool> {
    const [moneyPool] = await db.insert(schema.moneyPools)
      .values({
        ...poolData,
        id: poolData.id || uuidv4(),
        totalAmount: poolData.totalAmount || 0,
        status: poolData.status || "COLLECTING",
        createdAt: poolData.createdAt || new Date(),
        distributed: poolData.distributed || false
      })
      .returning();

    return moneyPool;
  }

  // Get money pool by ID
  async getMoneyPoolById(moneyPoolId: string): Promise<MoneyPool | null> {
    const moneyPools = await db.select()
      .from(schema.moneyPools)
      .where(eq(schema.moneyPools.id, moneyPoolId))
      .limit(1);

    return moneyPools.length > 0 ? moneyPools[0] : null;
  }

  // Get money pool by tournament ID
  async getMoneyPoolByTournamentId(tournamentId: string): Promise<MoneyPool | null> {
    const moneyPools = await db.select()
      .from(schema.moneyPools)
      .where(eq(schema.moneyPools.tournamentId, tournamentId))
      .limit(1);

    return moneyPools.length > 0 ? moneyPools[0] : null;
  }

  // Add contribution to money pool
  async addMoneyPoolContribution(contributionData: InsertMoneyPoolContribution): Promise<MoneyPoolContribution> {
    // Start a transaction
    const [contribution] = await db.insert(schema.moneyPoolContributions)
      .values({
        ...contributionData,
        id: contributionData.id || uuidv4(),
        createdAt: contributionData.createdAt || new Date(),
        status: contributionData.status || "PENDING"
      })
      .returning();

    // Update the money pool total
    await db.update(schema.moneyPools)
      .set({
        totalAmount: sql`${schema.moneyPools.totalAmount} + ${contributionData.amount}`
      })
      .where(eq(schema.moneyPools.id, contributionData.moneyPoolId));

    return contribution;
  }

  // Update contribution status
  async updateContributionStatus(
    contributionId: string,
    status: string,
    completedAt?: Date
  ): Promise<MoneyPoolContribution | null> {
    const updateData: any = { status };
    if (completedAt) {
      updateData.completedAt = completedAt;
    }

    const [contribution] = await db.update(schema.moneyPoolContributions)
      .set(updateData)
      .where(eq(schema.moneyPoolContributions.id, contributionId))
      .returning();

    return contribution || null;
  }

  // Distribute money pool to winner
  async distributeMoneyPool(
    moneyPoolId: string,
    winnerId: number
  ): Promise<MoneyPool | null> {
    const [moneyPool] = await db.update(schema.moneyPools)
      .set({
        status: "DISTRIBUTED",
        winnerId,
        distributed: true,
        closedAt: new Date()
      })
      .where(eq(schema.moneyPools.id, moneyPoolId))
      .returning();

    return moneyPool || null;
  }

  // Get user's PayPal transactions
  async getUserPayPalTransactions(userId: number): Promise<PaypalTransaction[]> {
    return db.select()
      .from(schema.paypalTransactions)
      .where(eq(schema.paypalTransactions.userId, userId))
      .orderBy(desc(schema.paypalTransactions.createdAt));
  }
}

// Create and export a singleton instance
export const supabaseDatabaseStorage = new SupabaseDatabaseStorage();
