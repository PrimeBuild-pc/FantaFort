import express from 'express';
import { getTopProPlayers, updateProPlayerRankings } from './pro-players-api';
import { db } from './db';
import { players } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Get top pro players
 * GET /api/workshop/top-players
 */
router.get('/top-players', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 500;
    const proPlayers = await getTopProPlayers(limit);
    
    res.json(proPlayers);
  } catch (error) {
    console.error('Error fetching top players:', error);
    res.status(500).json({ error: 'Failed to fetch top players' });
  }
});

/**
 * Get player details
 * GET /api/workshop/player/:id
 */
router.get('/player/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const proPlayers = await getTopProPlayers();
    const player = proPlayers.find(p => p.id === id);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(player);
  } catch (error) {
    console.error('Error fetching player details:', error);
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
});

/**
 * Add players to user's team
 * POST /api/workshop/add-to-team
 */
router.post('/add-to-team', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { playerIds } = req.body;
    
    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({ error: 'Invalid player IDs' });
    }
    
    // Get user's team ID
    const user = req.user as any;
    const teamId = user.teamId;
    
    if (!teamId) {
      return res.status(400).json({ error: 'User does not have a team' });
    }
    
    // Get pro players data
    const proPlayers = await getTopProPlayers();
    const selectedPlayers = proPlayers.filter(p => playerIds.includes(p.id));
    
    if (selectedPlayers.length === 0) {
      return res.status(400).json({ error: 'No valid players selected' });
    }
    
    // Check if players already exist in the database
    const existingPlayers = await db.select().from(players).where(
      eq(players.id, playerIds[0])
    );
    
    // Add players to the database if they don't exist
    const playersToAdd = [];
    
    for (const player of selectedPlayers) {
      const existingPlayer = existingPlayers.find(p => p.id === player.id);
      
      if (!existingPlayer) {
        playersToAdd.push({
          id: player.id,
          name: player.name,
          team: player.team,
          avatar: player.avatar || '',
          points: 0,
          price: Math.floor(player.score || 50) * 10, // Base price on player score
          rarity: getRarityFromScore(player.score || 0),
          role: 'FLEX',
          teamId,
          eliminations: player.eliminations,
          winRate: player.winRate,
          kd: player.kd,
          lastUpdatedAt: new Date()
        });
      } else {
        // Update existing player's team ID
        await db.update(players)
          .set({ teamId })
          .where(eq(players.id, player.id));
      }
    }
    
    // Insert new players
    if (playersToAdd.length > 0) {
      await db.insert(players).values(playersToAdd);
    }
    
    res.json({ 
      success: true, 
      message: `Added ${selectedPlayers.length} players to team`,
      players: selectedPlayers
    });
  } catch (error) {
    console.error('Error adding players to team:', error);
    res.status(500).json({ error: 'Failed to add players to team' });
  }
});

/**
 * Manually trigger pro player rankings update
 * POST /api/workshop/update-rankings
 */
router.post('/update-rankings', async (req, res) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.user || !(req.user as any).isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const updatedRankings = await updateProPlayerRankings();
    
    res.json({
      success: true,
      message: 'Pro player rankings updated',
      count: updatedRankings.length
    });
  } catch (error) {
    console.error('Error updating pro player rankings:', error);
    res.status(500).json({ error: 'Failed to update pro player rankings' });
  }
});

/**
 * Determine player rarity based on score
 * @param score Player score
 * @returns Rarity string
 */
function getRarityFromScore(score: number): string {
  if (score >= 90) return 'LEGENDARY';
  if (score >= 80) return 'EPIC';
  if (score >= 70) return 'RARE';
  if (score >= 60) return 'UNCOMMON';
  return 'COMMON';
}

export default router;
