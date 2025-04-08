import { Request, Response } from "express";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { getWebSocketManager, WebSocketMessageType } from "./websocket";
import type { Express } from "express";

export function setupPlayerRoutes(app: Express) {
  // Get players for user's team
  app.get("/api/players", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const user = req.user as User;
      const team = await storage.getTeamByUserId(user.id);
      
      if (!team) {
        return res.status(404).json({ error: "No team found" });
      }
      
      const players = await storage.getPlayersByTeamId(team.id);
      res.status(200).json(players);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch players" });
    }
  });
  
  // Get available players for marketplace
  app.get("/api/players/marketplace", async (req: Request, res: Response) => {
    try {
      const players = await storage.getMarketplacePlayers();
      res.status(200).json(players);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch marketplace players" });
    }
  });
  
  // Acquire a player for user's team
  app.post("/api/players/:playerId/acquire", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { playerId } = req.params;
      const user = req.user as User;
      
      // Get user's team
      const team = await storage.getTeamByUserId(user.id);
      if (!team) {
        return res.status(404).json({ error: "You don't have a team yet" });
      }
      
      // Get player details
      const player = await storage.getPlayer(playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Check if player is already on user's team
      const teamPlayers = await storage.getPlayersByTeamId(team.id);
      if (teamPlayers.some(p => p.id === playerId)) {
        return res.status(400).json({ error: "Player is already on your team" });
      }
      
      // Check team roster limit
      if (teamPlayers.length >= 8) {
        return res.status(400).json({ error: "Your team roster is full (8/8 players)" });
      }
      
      // Check if user has enough coins (in a real app)
      // const cost = player.points * 5; // Example cost calculation
      // if (user.coins < cost) {
      //   return res.status(400).json({ error: "Not enough coins to acquire this player" });
      // }
      
      // Update the player to be on the user's team
      const updatedPlayer = await storage.updatePlayerTeam(playerId, team.id);
      
      // Send WebSocket notification about player acquisition
      const wsManager = getWebSocketManager();
      if (wsManager) {
        // Create notification
        const notification = await storage.createNotification({
          title: "Player Acquired",
          message: `${team.name} acquired player ${updatedPlayer.name}`,
          type: "INFO",
          userId: null, // broadcast to all
          readAt: null,
          relatedEntityId: updatedPlayer.id,
          relatedEntityType: "PLAYER"
        });
        
        // Notify all clients with enhanced information
        wsManager.notifyNewNotification(notification.id);
        wsManager.notifyPlayerAcquired(
          updatedPlayer.id, 
          team.id,
          updatedPlayer.name,
          team.name
        );
        
        // Refresh marketplace data for all clients
        const marketplacePlayers = await storage.getMarketplacePlayers();
        wsManager.broadcast({
          type: WebSocketMessageType.MARKET_UPDATE,
          payload: { 
            action: "PLAYER_REMOVED", 
            playerId: updatedPlayer.id,
            availablePlayers: marketplacePlayers.length 
          },
          timestamp: Date.now()
        });
      }
      
      res.status(200).json({ success: true, message: "Player acquired successfully" });
    } catch (err) {
      console.error("Failed to acquire player:", err);
      res.status(500).json({ error: "Failed to acquire player" });
    }
  });
}