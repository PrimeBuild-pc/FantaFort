import { pgTable, text, serial, integer, boolean, timestamp, uuid, numeric, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  coins: integer("coins").notNull().default(1000),
  teamId: text("team_id"),
  avatar: text("avatar"),
  email: text("email"),
  isPublicProfile: boolean("is_public_profile").default(false),
});

// Teams table
export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  rank: integer("rank").notNull().default(999),
  points: integer("points").notNull().default(0),
  logo: text("logo"),
  isPublic: boolean("is_public").default(true),
  description: text("description"),
});

// Players table
export const players = pgTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  team: text("team").notNull(),
  avatar: text("avatar"),
  points: integer("points").notNull().default(0),
  price: integer("price").notNull().default(100),
  rarity: text("rarity").notNull().default("COMMON"),
  role: text("role").notNull().default("FLEX"),
  userId: integer("user_id").references(() => users.id),
  teamId: text("team_id").references(() => teams.id),
  isTeamCaptain: boolean("is_team_captain").default(false),
  eliminations: integer("eliminations").notNull().default(0),
  winRate: integer("win_rate").notNull().default(0),
  kd: integer("kd").notNull().default(0),
  accuracy: integer("accuracy"),
  buildSpeed: integer("build_speed"),
  clutchFactor: integer("clutch_factor"),
  consistency: integer("consistency"),
  tournaments: integer("tournaments"),
  avgPlacement: integer("avg_placement"),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
  historicalPerformance: text("historical_performance"),
  weeklyPoints: integer("weekly_points").default(0),
  monthlyPoints: integer("monthly_points").default(0),
  seasonPoints: integer("season_points").default(0),
  seasonTrend: text("season_trend").default("STABLE"),
});

// Team members table
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id),
  userId: integer("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  role: text("role").default("MEMBER"),
});

// Tournaments table
export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  type: text("type").notNull(),
  prizePool: integer("prize_pool").notNull(),
  registeredTeams: integer("registered_teams").notNull().default(0),
  maxTeams: integer("max_teams").notNull(),
  description: text("description"),
  status: text("status").default("UPCOMING"),
});

// Stats sharing table
export const statsSharing = pgTable("stats_sharing", {
  id: text("id").primaryKey(),
  shareCode: text("share_code").notNull().unique(),
  teamId: text("team_id").references(() => teams.id),
  userId: integer("user_id").references(() => users.id),
  playerId: text("player_id").references(() => players.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  accessCount: integer("access_count").default(0),
  maxAccesses: integer("max_accesses"),
});

// Access requests table
export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  requestorId: integer("requestor_id").notNull().references(() => users.id),
  targetId: text("target_id").notNull(), // Can be a team ID or player ID
  targetType: text("target_type").notNull(), // "TEAM" or "PLAYER"
  status: text("status").notNull().default("PENDING"), // "PENDING", "APPROVED", "DENIED"
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  responseAt: timestamp("response_at"),
  message: text("message"),
});

// Performance history table
export const performanceHistory = pgTable("performance_history", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => players.id),
  date: timestamp("date").notNull(),
  points: integer("points").notNull().default(0),
  eliminations: integer("eliminations").default(0),
  winRate: integer("win_rate").default(0),
  kd: integer("kd").default(0),
  weekNumber: integer("week_number"),
});

// Define schemas for data insertion
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, lastUpdatedAt: true });
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true, joinedAt: true });
export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true });
export const insertStatsSharingSchema = createInsertSchema(statsSharing).omit({ id: true, createdAt: true });
export const insertAccessRequestSchema = createInsertSchema(accessRequests).omit({ id: true, requestedAt: true, responseAt: true });
export const insertPerformanceHistorySchema = createInsertSchema(performanceHistory).omit({ id: true });

// Game phases table
export const gamePhases = pgTable("game_phases", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("UPCOMING"), // UPCOMING, ACTIVE, COMPLETED
  type: text("type").notNull(), // DRAFT, REGULAR_SEASON, PLAYOFFS, TRANSFER_WINDOW, OFF_SEASON
  notificationSent: boolean("notification_sent").notNull().default(false),
});

// Game settings table
export const gameSettings = pgTable("game_settings", {
  id: text("id").primaryKey(),
  seasonName: text("season_name").notNull(),
  seasonStartDate: timestamp("season_start_date").notNull(),
  seasonEndDate: timestamp("season_end_date").notNull(),
  startingCoins: integer("starting_coins").notNull().default(1000),
  transferWindowDuration: integer("transfer_window_duration").notNull(), // in hours
  priceUpdateFrequency: integer("price_update_frequency").notNull(), // in hours
  minPlayerPrice: integer("min_player_price").notNull(),
  maxPlayerPrice: integer("max_player_price").notNull(),
  draftEnabled: boolean("draft_enabled").notNull().default(false),
  draftDate: timestamp("draft_date"),
  draftDuration: integer("draft_duration").notNull(), // in minutes
  currentPhaseId: text("current_phase_id").references(() => gamePhases.id),
});

// Price updates table
export const priceUpdates = pgTable("price_updates", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => players.id),
  oldPrice: integer("old_price").notNull(),
  newPrice: integer("new_price").notNull(),
  updateTime: timestamp("update_time").notNull().defaultNow(),
  reason: text("reason").notNull(), // PERFORMANCE, MARKET_DEMAND, SCHEDULED_UPDATE, ADMIN_ADJUSTMENT
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // null means broadcast to all users
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // INFO, WARNING, SUCCESS, ERROR, TRANSFER_WINDOW, PRICE_CHANGE, GAME_PHASE
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
  relatedEntityId: text("related_entity_id"),
  relatedEntityType: text("related_entity_type"), // PLAYER, TEAM, TOURNAMENT, GAME_PHASE
});

// Define schemas for data insertion
export const insertGamePhaseSchema = createInsertSchema(gamePhases).omit({ id: true });
export const insertGameSettingsSchema = createInsertSchema(gameSettings).omit({ id: true });
export const insertPriceUpdateSchema = createInsertSchema(priceUpdates).omit({ id: true, updateTime: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

// Define types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type InsertStatsSharing = z.infer<typeof insertStatsSharingSchema>;
export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;
export type InsertPerformanceHistory = z.infer<typeof insertPerformanceHistorySchema>;
export type InsertGamePhase = z.infer<typeof insertGamePhaseSchema>;
export type InsertGameSettings = z.infer<typeof insertGameSettingsSchema>;
export type InsertPriceUpdate = z.infer<typeof insertPriceUpdateSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type StatsSharing = typeof statsSharing.$inferSelect;
export type AccessRequest = typeof accessRequests.$inferSelect;
export type PerformanceHistory = typeof performanceHistory.$inferSelect;
export type GamePhase = typeof gamePhases.$inferSelect;
export type GameSettings = typeof gameSettings.$inferSelect;
export type PriceUpdateEvent = typeof priceUpdates.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

// Tournament registration schema
export const tournamentRegistrations = pgTable("tournament_registrations", {
  id: serial("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  teamId: text("team_id").notNull().references(() => teams.id),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  status: text("status").notNull().default("REGISTERED"),
});

// Additional schemas for tournament registrations
export const insertTournamentRegistrationSchema = createInsertSchema(tournamentRegistrations).omit({ id: true });
export type InsertTournamentRegistration = z.infer<typeof insertTournamentRegistrationSchema>;
export type TournamentRegistration = typeof tournamentRegistrations.$inferSelect;

// Money Pools table for real-money tournaments
export const moneyPools = pgTable("money_pools", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("COLLECTING"), // COLLECTING, CLOSED, DISTRIBUTED
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  winnerId: integer("winner_id").references(() => users.id),
  distributed: boolean("distributed").notNull().default(false),
});

// Contributions to money pools from users
export const moneyPoolContributions = pgTable("money_pool_contributions", {
  id: text("id").primaryKey(),
  moneyPoolId: text("money_pool_id").notNull().references(() => moneyPools.id),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  transactionId: text("transaction_id"), // Reference to PayPal transaction
  status: text("status").notNull().default("PENDING"), // PENDING, COMPLETED, FAILED, REFUNDED
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// PayPal transactions table
export const paypalTransactions = pgTable("paypal_transactions", {
  id: text("id").primaryKey(),
  paypalTransactionId: text("paypal_transaction_id").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  type: text("type").notNull(), // DEPOSIT, WITHDRAWAL
  status: text("status").notNull().default("PENDING"), // PENDING, COMPLETED, FAILED, REFUNDED
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  paypalResponse: json("paypal_response"), // Store full response for reference
});

// Define schemas for data insertion
export const insertMoneyPoolSchema = createInsertSchema(moneyPools).omit({ id: true, createdAt: true, closedAt: true });
export const insertMoneyPoolContributionSchema = createInsertSchema(moneyPoolContributions).omit({ id: true, createdAt: true, completedAt: true });
export const insertPaypalTransactionSchema = createInsertSchema(paypalTransactions).omit({ id: true, createdAt: true, completedAt: true });

export type InsertMoneyPool = z.infer<typeof insertMoneyPoolSchema>;
export type InsertMoneyPoolContribution = z.infer<typeof insertMoneyPoolContributionSchema>;
export type InsertPaypalTransaction = z.infer<typeof insertPaypalTransactionSchema>;

export type MoneyPool = typeof moneyPools.$inferSelect;
export type MoneyPoolContribution = typeof moneyPoolContributions.$inferSelect;
export type PaypalTransaction = typeof paypalTransactions.$inferSelect;
