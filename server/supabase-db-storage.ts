import { v4 as uuidv4 } from "uuid";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
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
  PriceUpdateEvent, InsertPriceUpdateEvent,
  Notification, InsertNotification,
  MoneyPool, InsertMoneyPool,
  MoneyPoolContribution, InsertMoneyPoolContribution,
  PaypalTransaction, InsertPaypalTransaction
} from "@shared/schema";

// Promisify scrypt
const scryptAsync = promisify(scrypt);

/**
 * Database storage implementation using Supabase
 */
export class SupabaseDatabaseStorage {
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
  
  /**
   * Player Operations
   */
  
  // Get players by team ID
  async getPlayersByTeamId(teamId: string): Promise<Player[]> {
    return db.select()
      .from(schema.players)
      .where(eq(schema.players.teamId, teamId));
  }
  
  // Add player to team
  async addPlayerToTeam(playerId: string, teamId: string): Promise<Player | null> {
    const [player] = await db.update(schema.players)
      .set({ teamId })
      .where(eq(schema.players.id, playerId))
      .returning();
    
    return player || null;
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
