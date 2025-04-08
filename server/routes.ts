import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { v4 as uuidv4 } from "uuid";
import { setupAuth } from "./auth";
import {
  insertUserSchema,
  insertTeamSchema,
  insertStatsSharingSchema,
  insertAccessRequestSchema,
  insertPerformanceHistorySchema,
  insertGamePhaseSchema,
  insertGameSettingsSchema,
  insertPriceUpdateSchema,
  insertNotificationSchema
} from "@shared/schema";
import { fetchFortnitePlayerStats } from "./fortnite-api";
import { setupPlayerRoutes } from "./player-routes";
import { setupTournamentRoutes } from "./tournament-routes";
import { setupWebSocket, getWebSocketManager } from "./websocket";
import { initializePlayers } from "./player-init";
import { paypalRouter } from "./new-paypal-routes";
import { initializeDatabase } from "./supabase-db";
import workshopRoutes from "./workshop-routes";
import { scheduleProPlayerUpdates } from "./pro-players-api";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication and session
  setupAuth(app);

  // User routes
  app.get("/api/user/current", (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;

    // Return a safe user object without the password
    res.json({
      id: user.id,
      username: user.username,
      coins: user.coins || 2500, // Default coins if not set
      teamId: user.teamId,
      // Optionally include other non-sensitive fields
      avatar: user.avatar,
      email: user.email,
      isPublicProfile: user.isPublicProfile
    });
  });

  // Team routes
  app.get("/api/team", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;
    try {
      const team = await storage.getTeamByUserId(user.id);

      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      res.json({
        id: team.id,
        name: team.name,
        createdAt: "2 weeks ago", // Simplified for demo
        rank: team.rank,
        points: team.points
      });
    } catch (error) {
      console.error("Get team error:", error);
      res.status(500).json({ error: "Failed to get team" });
    }
  });

  app.post("/api/team/create", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;

    try {
      const result = insertTeamSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      const team = await storage.createTeam({
        ...result.data,
        ownerId: user.id
      });

      // Update user with team ID
      user.teamId = team.id;

      // Add user as team member
      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id
      });

      res.status(201).json({
        id: team.id,
        name: team.name,
        ownerId: team.ownerId,
        rank: team.rank,
        points: team.points
      });
    } catch (error) {
      console.error("Create team error:", error);
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  app.get("/api/team/members", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;

    if (!user.teamId) {
      return res.status(404).json({ error: "No team found" });
    }

    try {
      const teamMembers = await storage.getTeamMembers(user.teamId);

      // For demo purposes, creating sample team members
      const sampleMembers = [
        {
          id: "member1",
          username: "ProPlayer123",
          avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40&q=80"
        },
        {
          id: "member2",
          username: "FortniteKing",
          avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40&q=80"
        },
        {
          id: "member3",
          username: "BattleRoyale",
          avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40&q=80"
        },
        {
          id: "member4",
          username: user.username,
          avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40&q=80"
        }
      ];

      res.json(sampleMembers);
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({ error: "Failed to get team members" });
    }
  });

  app.get("/api/team/performance", async (req: Request, res: Response) => {
    // Sample performance data
    const performanceData = {
      weekData: [80, 120, 90, 160, 200, 240, 170],
      monthData: [90, 140, 110, 180, 220, 260, 190],
      seasonData: [100, 150, 120, 190, 230, 280, 210]
    };

    res.json(performanceData);
  });

  // Setup player routes
  setupPlayerRoutes(app);

  // Leaderboard routes
  app.get("/api/leaderboard", async (req: Request, res: Response) => {
    // Sample leaderboard data
    const leaderboardTeams = [
      {
        id: "team1",
        name: "Victory Royales",
        points: 3256,
        rank: 1,
        isUserTeam: false
      },
      {
        id: "team2",
        name: "Tilted Towers",
        points: 2984,
        rank: 2,
        isUserTeam: false
      },
      {
        id: "team3",
        name: "Pleasant Park",
        points: 2721,
        rank: 3,
        isUserTeam: false
      },
      {
        id: "team4",
        name: "Salty Springs",
        points: 2589,
        rank: 4,
        isUserTeam: false
      },
      {
        id: "team5",
        name: "Storm Chasers",
        points: 1258,
        rank: 42,
        isUserTeam: true
      }
    ];

    res.json(leaderboardTeams);
  });

  // Setup tournament routes
  setupTournamentRoutes(app);

  // Initialize sample marketplace players
  await initializePlayers();

  // Statistics Sharing Routes
  app.post("/api/stats/share", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;

    try {
      const result = insertStatsSharingSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      const shareData = {
        ...result.data,
        userId: user.id
      };

      const statsShare = await storage.createStatsShare(shareData);

      res.status(201).json({
        id: statsShare.id,
        shareCode: statsShare.shareCode,
        createdAt: statsShare.createdAt,
        expiresAt: statsShare.expiresAt
      });
    } catch (error) {
      console.error("Create stats share error:", error);
      res.status(500).json({ error: "Failed to create stats share" });
    }
  });

  app.get("/api/stats/share/:shareCode", async (req: Request, res: Response) => {
    try {
      const { shareCode } = req.params;
      const share = await storage.getStatsShareByCode(shareCode);

      if (!share || !share.isActive) {
        return res.status(404).json({ error: "Share link not found or expired" });
      }

      let shareData: any = { shareId: share.id };

      // Increment access count
      await storage.incrementShareAccessCount(share.id);

      // Retrieve the shared data based on what type of data is being shared
      if (share.teamId) {
        const team = await storage.getTeam(share.teamId);
        if (!team) {
          return res.status(404).json({ error: "Team not found" });
        }

        const players = await storage.getPlayersByTeamId(share.teamId);
        const teamHistory = await storage.getTeamPerformanceHistory(share.teamId);

        shareData = {
          ...shareData,
          type: 'TEAM',
          team,
          players,
          performanceHistory: teamHistory
        };
      } else if (share.playerId) {
        const player = await storage.getPlayer(share.playerId);
        if (!player) {
          return res.status(404).json({ error: "Player not found" });
        }

        const playerHistory = await storage.getPlayerPerformanceHistory(share.playerId);

        shareData = {
          ...shareData,
          type: 'PLAYER',
          player,
          performanceHistory: playerHistory
        };
      } else if (share.userId) {
        const userTeam = await storage.getTeamByUserId(share.userId);
        const userPlayers = await storage.getPlayersByUserId(share.userId);

        shareData = {
          ...shareData,
          type: 'USER',
          team: userTeam,
          players: userPlayers
        };
      }

      res.json(shareData);
    } catch (error) {
      console.error("Get stats share error:", error);
      res.status(500).json({ error: "Failed to get stats share" });
    }
  });

  app.delete("/api/stats/share/:shareId", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { shareId } = req.params;
      await storage.deactivateShare(shareId);
      res.json({ success: true });
    } catch (error) {
      console.error("Deactivate stats share error:", error);
      res.status(500).json({ error: "Failed to deactivate stats share" });
    }
  });

  // Access Request Routes
  app.post("/api/access-requests", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;

    try {
      const result = insertAccessRequestSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      const requestData = {
        ...result.data,
        requestorId: user.id
      };

      const accessRequest = await storage.createAccessRequest(requestData);

      res.status(201).json(accessRequest);
    } catch (error) {
      console.error("Create access request error:", error);
      res.status(500).json({ error: "Failed to create access request" });
    }
  });

  app.get("/api/access-requests/pending", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;

    try {
      const pendingRequests = await storage.getPendingAccessRequests(user.id);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Get pending access requests error:", error);
      res.status(500).json({ error: "Failed to get pending access requests" });
    }
  });

  app.put("/api/access-requests/:requestId", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { requestId } = req.params;
      const { status } = req.body;

      if (!status || !['APPROVED', 'DENIED'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updatedRequest = await storage.updateAccessRequestStatus(
        parseInt(requestId),
        status
      );

      if (!updatedRequest) {
        return res.status(404).json({ error: "Access request not found" });
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error("Update access request error:", error);
      res.status(500).json({ error: "Failed to update access request" });
    }
  });

  // Game Phase Routes
  app.get("/api/game-phases", async (req: Request, res: Response) => {
    try {
      const phases = await storage.getGamePhases();
      res.json(phases);
    } catch (error) {
      console.error("Get game phases error:", error);
      res.status(500).json({ error: "Failed to get game phases" });
    }
  });

  app.get("/api/game-phases/active", async (req: Request, res: Response) => {
    try {
      const activePhase = await storage.getActiveGamePhase();

      if (!activePhase) {
        return res.status(404).json({ error: "No active game phase found" });
      }

      res.json(activePhase);
    } catch (error) {
      console.error("Get active game phase error:", error);
      res.status(500).json({ error: "Failed to get active game phase" });
    }
  });

  app.get("/api/game-phases/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const phase = await storage.getGamePhase(id);

      if (!phase) {
        return res.status(404).json({ error: "Game phase not found" });
      }

      res.json(phase);
    } catch (error) {
      console.error("Get game phase error:", error);
      res.status(500).json({ error: "Failed to get game phase" });
    }
  });

  app.post("/api/game-phases", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const result = insertGamePhaseSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      const phase = await storage.createGamePhase(result.data);
      res.status(201).json(phase);
    } catch (error) {
      console.error("Create game phase error:", error);
      res.status(500).json({ error: "Failed to create game phase" });
    }
  });

  app.put("/api/game-phases/:id", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { id } = req.params;
      const phase = await storage.getGamePhase(id);

      if (!phase) {
        return res.status(404).json({ error: "Game phase not found" });
      }

      const updates = req.body;
      const updatedPhase = await storage.updateGamePhase(id, updates);

      // Get WebSocket manager and broadcast phase change if status changed
      if (updates.status && updates.status !== phase.status && updatedPhase) {
        const wsManager = getWebSocketManager();
        if (wsManager) {
          wsManager.notifyGamePhaseChange(updatedPhase.id, updatedPhase.type);

          // Create notification
          const notification = await storage.createNotification({
            title: `Game Phase: ${updatedPhase.name}`,
            message: `The game phase has changed to ${updatedPhase.name}: ${updatedPhase.description}`,
            type: "GAME_PHASE",
            userId: null, // broadcast to all
            readAt: null,
            relatedEntityId: updatedPhase.id,
            relatedEntityType: "GAME_PHASE"
          });

          // Broadcast notification
          wsManager.notifyNewNotification(notification.id);
        }

        // If a phase is activated, update the game settings current phase
        if (updates.status === 'ACTIVE') {
          const gameSettings = await storage.getGameSettings();
          if (gameSettings) {
            await storage.updateGameSettings({
              ...gameSettings,
              currentPhaseId: id
            });
          }
        }
      }

      res.json(updatedPhase);
    } catch (error) {
      console.error("Update game phase error:", error);
      res.status(500).json({ error: "Failed to update game phase" });
    }
  });

  // Game Settings Routes
  app.get("/api/game-settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getGameSettings();

      if (!settings) {
        return res.status(404).json({ error: "Game settings not found" });
      }

      res.json(settings);
    } catch (error) {
      console.error("Get game settings error:", error);
      res.status(500).json({ error: "Failed to get game settings" });
    }
  });

  app.post("/api/game-settings", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const result = insertGameSettingsSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      const settings = await storage.createGameSettings(result.data);
      res.status(201).json(settings);
    } catch (error) {
      console.error("Create game settings error:", error);
      res.status(500).json({ error: "Failed to create game settings" });
    }
  });

  app.put("/api/game-settings", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const settings = await storage.getGameSettings();

      if (!settings) {
        return res.status(404).json({ error: "Game settings not found" });
      }

      const updates = req.body;
      const updatedSettings = await storage.updateGameSettings(updates);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Update game settings error:", error);
      res.status(500).json({ error: "Failed to update game settings" });
    }
  });

  // Price Updates Routes
  app.post("/api/price-updates", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const result = insertPriceUpdateSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      const priceUpdate = await storage.createPriceUpdate(result.data);

      // Get WebSocket manager and broadcast price change
      const wsManager = getWebSocketManager();
      if (wsManager) {
        const player = await storage.getPlayer(priceUpdate.playerId);
        if (player) {
          wsManager.notifyPriceUpdate(player.id, priceUpdate.oldPrice, priceUpdate.newPrice);

          // Create notification
          const notification = await storage.createNotification({
            title: `Price Change: ${player.name}`,
            message: `${player.name}'s price has changed from ${priceUpdate.oldPrice} to ${priceUpdate.newPrice} coins.`,
            type: "PRICE_CHANGE",
            userId: null, // broadcast to all
            readAt: null,
            relatedEntityId: player.id,
            relatedEntityType: "PLAYER"
          });

          // Broadcast notification
          wsManager.notifyNewNotification(notification.id);
        }
      }

      res.status(201).json(priceUpdate);
    } catch (error) {
      console.error("Create price update error:", error);
      res.status(500).json({ error: "Failed to create price update" });
    }
  });

  app.get("/api/price-updates/player/:playerId", async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params;
      const priceHistory = await storage.getPlayerPriceHistory(playerId);
      res.json(priceHistory);
    } catch (error) {
      console.error("Get player price history error:", error);
      res.status(500).json({ error: "Failed to get player price history" });
    }
  });

  app.get("/api/price-updates/recent", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const recentUpdates = await storage.getRecentPriceUpdates(limit);
      res.json(recentUpdates);
    } catch (error) {
      console.error("Get recent price updates error:", error);
      res.status(500).json({ error: "Failed to get recent price updates" });
    }
  });

  // Notification Routes
  app.get("/api/notifications", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;

    try {
      const notifications = await storage.getUserNotifications(user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as any;

    try {
      const unreadNotifications = await storage.getUnreadNotifications(user.id);
      res.json(unreadNotifications);
    } catch (error) {
      console.error("Get unread notifications error:", error);
      res.status(500).json({ error: "Failed to get unread notifications" });
    }
  });

  app.post("/api/notifications", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const result = insertNotificationSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      // Use the data directly - createdAt is handled by defaultNow() in the schema
      const notification = await storage.createNotification(result.data);

      // Get WebSocket manager and notify about the notification
      const wsManager = getWebSocketManager();
      if (wsManager) {
        if (!notification.userId) {
          // Broadcast to all users
          wsManager.notifyNewNotification(notification.id);
        } else {
          // Send to specific user
          wsManager.notifyNewNotification(notification.id, notification.userId);
        }
      }

      res.status(201).json(notification);
    } catch (error) {
      console.error("Create notification error:", error);
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  app.put("/api/notifications/:id/read", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id);

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      res.json(notification);
    } catch (error) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Performance History Routes
  app.post("/api/performance-history", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const result = insertPerformanceHistorySchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      const performanceRecord = await storage.addPerformanceRecord(result.data);
      res.status(201).json(performanceRecord);
    } catch (error) {
      console.error("Add performance record error:", error);
      res.status(500).json({ error: "Failed to add performance record" });
    }
  });

  app.get("/api/performance-history/player/:playerId", async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params;
      const history = await storage.getPlayerPerformanceHistory(playerId);
      res.json(history);
    } catch (error) {
      console.error("Get player performance history error:", error);
      res.status(500).json({ error: "Failed to get player performance history" });
    }
  });

  app.get("/api/performance-history/team/:teamId", async (req: Request, res: Response) => {
    try {
      const { teamId } = req.params;
      const history = await storage.getTeamPerformanceHistory(teamId);
      res.json(history);
    } catch (error) {
      console.error("Get team performance history error:", error);
      res.status(500).json({ error: "Failed to get team performance history" });
    }
  });

  app.get("/api/performance-history/player/:playerId/week/:weekNumber", async (req: Request, res: Response) => {
    try {
      const { playerId, weekNumber } = req.params;
      const history = await storage.getWeeklyPerformance(playerId, parseInt(weekNumber));
      res.json(history);
    } catch (error) {
      console.error("Get weekly performance error:", error);
      res.status(500).json({ error: "Failed to get weekly performance" });
    }
  });

  // Setup PayPal and Money Pool routes
  app.use("/api/paypal", paypalRouter);

  // Setup Workshop routes
  app.use("/api/workshop", workshopRoutes);

  const httpServer = createServer(app);

  // Initialize the WebSocket server
  setupWebSocket(httpServer);

  // Initialize the database
  await initializeDatabase();

  // Schedule pro player updates
  scheduleProPlayerUpdates();

  return httpServer;
}
