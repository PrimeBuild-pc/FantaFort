import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { User } from '@shared/schema';

// Define message types
export enum WebSocketMessageType {
  USER_CONNECTED = 'USER_CONNECTED',
  USER_DISCONNECTED = 'USER_DISCONNECTED',
  PLAYER_PRICE_UPDATE = 'PLAYER_PRICE_UPDATE',
  PLAYER_TRANSFER = 'PLAYER_TRANSFER',
  PLAYER_ACQUIRED = 'PLAYER_ACQUIRED',
  MARKET_UPDATE = 'MARKET_UPDATE',
  TEAM_UPDATE = 'TEAM_UPDATE',
  TOURNAMENT_UPDATE = 'TOURNAMENT_UPDATE',
  TOURNAMENT_REGISTRATION = 'TOURNAMENT_REGISTRATION',
  TOURNAMENT_LEADERBOARD_UPDATE = 'TOURNAMENT_LEADERBOARD_UPDATE',
  GAME_PHASE_CHANGE = 'GAME_PHASE_CHANGE',
  NEW_NOTIFICATION = 'NEW_NOTIFICATION',
  AUTHENTICATION_SUCCESS = 'AUTHENTICATION_SUCCESS',
  PLAYER_STATS_UPDATE = 'PLAYER_STATS_UPDATE',
  PRO_PLAYER_RANKING_UPDATE = 'PRO_PLAYER_RANKING_UPDATE',
}

// Define message interface
export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  timestamp: number;
}

interface ClientConnection {
  ws: WebSocket;
  userId?: number;
  isAuthenticated: boolean;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientConnection>;

  constructor(server: HttpServer) {
    // Create WebSocket server on a distinct path to avoid conflicts with Vite HMR
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Map();
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');

      // Register the new client
      this.clients.set(ws, { ws, isAuthenticated: false });

      // Handle incoming messages
      ws.on('message', (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          this.handleClientMessage(ws, parsedMessage);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Handle client disconnection
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        const client = this.clients.get(ws);

        if (client && client.isAuthenticated && client.userId) {
          // Broadcast that the user disconnected
          this.broadcast({
            type: WebSocketMessageType.USER_DISCONNECTED,
            payload: { userId: client.userId },
            timestamp: Date.now(),
          });
        }

        this.clients.delete(ws);
      });

      // Send a welcome message
      this.sendMessage(ws, {
        type: WebSocketMessageType.USER_CONNECTED,
        payload: { message: 'Connected to Fortnite Fantasy Football WebSocket Server' },
        timestamp: Date.now()
      });
    });
  }

  private handleClientMessage(ws: WebSocket, message: any) {
    if (!message.type) {
      console.error('Invalid message format: missing type');
      return;
    }

    // Handle authentication
    if (message.type === 'AUTHENTICATE') {
      const { userId } = message.payload;
      if (userId) {
        const client = this.clients.get(ws);
        if (client) {
          client.userId = userId;
          client.isAuthenticated = true;
          this.clients.set(ws, client);

          // Broadcast user connection to other clients
          this.broadcast({
            type: WebSocketMessageType.USER_CONNECTED,
            payload: { userId },
            timestamp: Date.now()
          }, ws); // Exclude the sender

          // Confirm authentication to the client
          this.sendMessage(ws, {
            type: WebSocketMessageType.AUTHENTICATION_SUCCESS,
            payload: { userId },
            timestamp: Date.now()
          });
        }
      }
    }
  }

  // Send a message to a specific client
  public sendMessage(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast a message to all connected clients or to specific users
  public broadcast(message: WebSocketMessage, exclude?: WebSocket) {
    this.clients.forEach((client, clientWs) => {
      if (clientWs !== exclude && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(message));
      }
    });
  }

  // Send a message to a specific user
  public sendToUser(userId: number, message: WebSocketMessage) {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Authenticate a user with the WebSocket connection
  public authenticateUser(userId: number, req: any) {
    // This method would be called by the Express session middleware to associate sessions with WebSocket connections
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    this.clients.forEach((client) => {
      // In a real implementation, you'd need a better way to identify the correct WebSocket connection
      // This is a simplified example
      if (!client.isAuthenticated) {
        client.userId = userId;
        client.isAuthenticated = true;
      }
    });
  }

  // Notify all clients about a price update
  public notifyPriceUpdate(playerId: string, oldPrice: number, newPrice: number) {
    this.broadcast({
      type: WebSocketMessageType.PLAYER_PRICE_UPDATE,
      payload: { playerId, oldPrice, newPrice },
      timestamp: Date.now()
    });
  }

  // Notify all clients about a player transfer
  public notifyPlayerTransfer(playerId: string, fromTeamId: string | null, toTeamId: string) {
    this.broadcast({
      type: WebSocketMessageType.PLAYER_TRANSFER,
      payload: { playerId, fromTeamId, toTeamId },
      timestamp: Date.now()
    });
  }

  // Notify all clients about a team update
  public notifyTeamUpdate(teamId: string) {
    this.broadcast({
      type: WebSocketMessageType.TEAM_UPDATE,
      payload: { teamId },
      timestamp: Date.now()
    });
  }

  // Notify all clients about a tournament update
  public notifyTournamentUpdate(tournamentId: string) {
    this.broadcast({
      type: WebSocketMessageType.TOURNAMENT_UPDATE,
      payload: { tournamentId },
      timestamp: Date.now()
    });
  }

  // Notify all clients about a market update (new player available)
  public notifyMarketUpdate(player: any) {
    this.broadcast({
      type: WebSocketMessageType.MARKET_UPDATE,
      payload: { player },
      timestamp: Date.now()
    });
  }

  // Notify about tournament registration
  public notifyTournamentRegistration(tournamentId: string, teamId: string, teamName?: string) {
    this.broadcast({
      type: WebSocketMessageType.TOURNAMENT_REGISTRATION,
      payload: { tournamentId, teamId, teamName },
      timestamp: Date.now()
    });
  }

  // Notify about tournament leaderboard update
  public notifyTournamentLeaderboardUpdate(tournamentId: string) {
    this.broadcast({
      type: WebSocketMessageType.TOURNAMENT_LEADERBOARD_UPDATE,
      payload: { tournamentId },
      timestamp: Date.now()
    });
  }

  // Notify all clients about a game phase change
  public notifyGamePhaseChange(phaseId: string, phaseType: string) {
    this.broadcast({
      type: WebSocketMessageType.GAME_PHASE_CHANGE,
      payload: { phaseId, phaseType },
      timestamp: Date.now()
    });
  }

  // Notify about a new notification (to a specific user or broadcast)
  public notifyNewNotification(notificationId: string, userId?: number) {
    const message = {
      type: WebSocketMessageType.NEW_NOTIFICATION,
      payload: { notificationId },
      timestamp: Date.now()
    };

    if (userId) {
      this.sendToUser(userId, message);
    } else {
      this.broadcast(message);
    }
  }

  // Notify all clients about a player acquisition
  public notifyPlayerAcquired(playerId: string, teamId: string, playerName?: string, teamName?: string) {
    this.broadcast({
      type: WebSocketMessageType.PLAYER_ACQUIRED,
      payload: {
        playerId,
        teamId,
        playerName, // Include player name if available
        teamName    // Include team name if available
      },
      timestamp: Date.now()
    });
  }

  // Notify all clients about a pro player stats update
  public notifyPlayerStatsUpdate(playerId: string, playerName: string, stats: any) {
    this.broadcast({
      type: WebSocketMessageType.PLAYER_STATS_UPDATE,
      payload: {
        playerId,
        playerName,
        stats
      },
      timestamp: Date.now()
    });
  }

  // Notify all clients about a pro player ranking update
  public notifyProPlayerRankingUpdate(playerId: string, playerName: string, rank: number, previousRank: number, score: number) {
    this.broadcast({
      type: WebSocketMessageType.PRO_PLAYER_RANKING_UPDATE,
      payload: {
        playerId,
        playerName,
        rank,
        previousRank,
        score
      },
      timestamp: Date.now()
    });
  }
}

// Create and export a singleton instance
let websocketManager: WebSocketManager | null = null;

export function setupWebSocket(server: HttpServer): WebSocketManager {
  if (!websocketManager) {
    websocketManager = new WebSocketManager(server);
  }
  return websocketManager;
}

export function getWebSocketManager(): WebSocketManager | null {
  return websocketManager;
}