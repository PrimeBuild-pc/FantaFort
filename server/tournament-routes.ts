import { Request, Response } from "express";
import { storage } from "./storage";
import { User } from "@shared/schema";
import type { Express } from "express";
import { getWebSocketManager, WebSocketMessageType } from "./websocket";

export function setupTournamentRoutes(app: Express) {
  // Get all tournaments
  app.get("/api/tournaments", async (req: Request, res: Response) => {
    try {
      // Fetch tournaments from storage
      const tournaments = await storage.getTournaments();
      
      // If the user is authenticated, check if their team is registered for any tournaments
      let userTeamId: string | undefined;
      if (req.isAuthenticated()) {
        const user = req.user as User;
        const team = await storage.getTeamByUserId(user.id);
        if (team) {
          userTeamId = team.id;
        }
      }
      
      // Enhance tournaments with isUserTeamRegistered flag
      const enhancedTournaments = await Promise.all(
        tournaments.map(async (tournament) => {
          // Check if user's team is registered for this tournament
          let isUserTeamRegistered = false;
          if (userTeamId) {
            const registrations = await storage.getTournamentRegistrations(tournament.id);
            isUserTeamRegistered = registrations.some(reg => reg.teamId === userTeamId);
          }
          
          return {
            ...tournament,
            isUserTeamRegistered
          };
        })
      );
      
      res.status(200).json(enhancedTournaments);
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });
  
  // Get tournament by ID
  app.get("/api/tournaments/:tournamentId", async (req: Request, res: Response) => {
    try {
      const { tournamentId } = req.params;
      const tournament = await storage.getTournament(tournamentId);
      
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      // Check if user's team is registered for this tournament
      let isUserTeamRegistered = false;
      if (req.isAuthenticated()) {
        const user = req.user as User;
        const team = await storage.getTeamByUserId(user.id);
        
        if (team) {
          const registrations = await storage.getTournamentRegistrations(tournamentId);
          isUserTeamRegistered = registrations.some(reg => reg.teamId === team.id);
        }
      }
      
      res.status(200).json({
        ...tournament,
        isUserTeamRegistered
      });
    } catch (err) {
      console.error("Failed to fetch tournament:", err);
      res.status(500).json({ error: "Failed to fetch tournament" });
    }
  });
  
  // Register team for tournament
  app.post("/api/tournaments/:tournamentId/register", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { tournamentId } = req.params;
      const user = req.user as User;
      
      // Check if tournament exists
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      // Check if tournament is full
      if (tournament.registeredTeams >= tournament.maxTeams) {
        return res.status(400).json({ error: "Tournament is full" });
      }
      
      // Get user's team
      const team = await storage.getTeamByUserId(user.id);
      if (!team) {
        return res.status(404).json({ error: "You don't have a team" });
      }
      
      // Check if team is already registered
      const registrations = await storage.getTournamentRegistrations(tournamentId);
      if (registrations.some(reg => reg.teamId === team.id)) {
        return res.status(400).json({ error: "Your team is already registered for this tournament" });
      }
      
      // Register team for tournament
      await storage.registerTeamForTournament({
        tournamentId,
        teamId: team.id,
        registeredAt: new Date(),
        status: 'REGISTERED'
      });
      
      // Update tournament registered teams count
      const updatedTournament = await storage.updateTournamentRegisteredTeams(tournamentId, tournament.registeredTeams + 1);
      
      // Create notification for tournament registration
      const notification = await storage.createNotification({
        title: "Tournament Registration",
        message: `Team ${team.name} has registered for ${tournament.name}`,
        type: "INFO",
        userId: null, // broadcast to all
        readAt: null,
        relatedEntityId: tournament.id,
        relatedEntityType: "TOURNAMENT"
      });
      
      // Send WebSocket notification
      const wsManager = getWebSocketManager();
      if (wsManager) {
        // Notify all clients about the tournament registration
        wsManager.notifyTournamentRegistration(tournamentId, team.id, team.name);
        
        // Notify about the tournament update (participant count changed)
        wsManager.notifyTournamentUpdate(tournamentId);
        
        // Send general notification
        wsManager.notifyNewNotification(notification.id);
      }
      
      res.status(200).json({ success: true, message: "Team registered successfully" });
    } catch (err) {
      console.error("Failed to register for tournament:", err);
      res.status(500).json({ error: "Failed to register for tournament" });
    }
  });
  
  // Unregister team from tournament
  app.post("/api/tournaments/:tournamentId/unregister", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { tournamentId } = req.params;
      const user = req.user as User;
      
      // Check if tournament exists
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      // Get user's team
      const team = await storage.getTeamByUserId(user.id);
      if (!team) {
        return res.status(404).json({ error: "You don't have a team" });
      }
      
      // Check if team is registered
      const registrations = await storage.getTournamentRegistrations(tournamentId);
      const existingRegistration = registrations.find(reg => reg.teamId === team.id);
      
      if (!existingRegistration) {
        return res.status(400).json({ error: "Your team is not registered for this tournament" });
      }
      
      // Unregister team from tournament
      await storage.unregisterTeamFromTournament(tournamentId, team.id);
      
      // Update tournament registered teams count
      const updatedTournament = await storage.updateTournamentRegisteredTeams(tournamentId, tournament.registeredTeams - 1);
      
      // Create notification for tournament unregistration
      const notification = await storage.createNotification({
        title: "Tournament Unregistration",
        message: `Team ${team.name} has withdrawn from ${tournament.name}`,
        type: "INFO",
        userId: null, // broadcast to all
        readAt: null,
        relatedEntityId: tournament.id,
        relatedEntityType: "TOURNAMENT"
      });
      
      // Send WebSocket notification
      const wsManager = getWebSocketManager();
      if (wsManager) {
        // Notify about the tournament update (participant count changed)
        wsManager.notifyTournamentUpdate(tournamentId);
        
        // Send general notification
        wsManager.notifyNewNotification(notification.id);
      }
      
      res.status(200).json({ success: true, message: "Team unregistered successfully" });
    } catch (err) {
      console.error("Failed to unregister from tournament:", err);
      res.status(500).json({ error: "Failed to unregister from tournament" });
    }
  });
}