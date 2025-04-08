const { supabase } = require('./supabase');
const { v4: uuidv4 } = require('uuid');

// Setup team routes
function setupTeamRoutes(app) {
  // Get user's team
  app.get("/api/team", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Get user's team ID
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', req.session.userId)
        .single();
      
      if (userError) throw userError;
      
      if (!user || !user.team_id) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Get team details
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', user.team_id)
        .single();
      
      if (teamError) throw teamError;
      
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      res.json({
        id: team.id,
        name: team.name,
        createdAt: team.created_at,
        rank: team.rank || 0,
        points: team.points || 0
      });
    } catch (error) {
      console.error("Get team error:", error);
      res.status(500).json({ error: "Failed to get team" });
    }
  });

  // Create a team
  app.post("/api/team", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: "Team name is required" });
      }
      
      // Check if user already has a team
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', req.session.userId)
        .single();
      
      if (userError) throw userError;
      
      if (user && user.team_id) {
        return res.status(400).json({ error: "User already has a team" });
      }
      
      // Create team
      const teamId = uuidv4();
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          id: teamId,
          name: name.trim(),
          owner_id: req.session.userId,
          rank: 0,
          points: 0,
          is_public: true
        })
        .select()
        .single();
      
      if (teamError) throw teamError;
      
      // Add user as team member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: req.session.userId,
          role: 'captain'
        });
      
      if (memberError) throw memberError;
      
      // Update user with team ID
      const { error: updateError } = await supabase
        .from('users')
        .update({ team_id: teamId })
        .eq('id', req.session.userId);
      
      if (updateError) throw updateError;
      
      res.status(201).json({
        id: team.id,
        name: team.name,
        ownerId: team.owner_id,
        rank: team.rank,
        points: team.points
      });
    } catch (error) {
      console.error("Create team error:", error);
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  // Add players to team
  app.post("/api/team/add-players", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { playerIds } = req.body;
      
      if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
        return res.status(400).json({ error: "Player IDs are required" });
      }
      
      // Get user's team ID
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', req.session.userId)
        .single();
      
      if (userError) throw userError;
      
      if (!user || !user.team_id) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Get players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds);
      
      if (playersError) throw playersError;
      
      // Update players with team ID
      const updatePromises = players.map(player => 
        supabase
          .from('players')
          .update({ team_id: user.team_id })
          .eq('id', player.id)
      );
      
      await Promise.all(updatePromises);
      
      res.json({ 
        success: true, 
        message: `Added ${players.length} players to team`,
        players: players
      });
    } catch (error) {
      console.error("Add players to team error:", error);
      res.status(500).json({ error: "Failed to add players to team" });
    }
  });
}

module.exports = { setupTeamRoutes };
