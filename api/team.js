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

      // Check for specific Supabase errors
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: "A team with this name already exists" });
      } else if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({ error: "Invalid user ID" });
      } else if (error.code === '42P01') { // Undefined table
        return res.status(500).json({ error: "Database table not found. Please contact support." });
      }

      // Generic error response
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  // Check and initialize database tables
  app.get("/api/team/init-db", async (req, res) => {
    try {
      // Check if tables exist
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .in('table_name', ['teams', 'team_members', 'players'])
        .eq('table_schema', 'public');

      if (tablesError) throw tablesError;

      const existingTables = tables.map(t => t.table_name);
      const missingTables = [];

      if (!existingTables.includes('teams')) missingTables.push('teams');
      if (!existingTables.includes('team_members')) missingTables.push('team_members');
      if (!existingTables.includes('players')) missingTables.push('players');

      // Create missing tables
      if (missingTables.length > 0) {
        const createTablesPromises = [];

        if (missingTables.includes('teams')) {
          createTablesPromises.push(
            supabase.rpc('create_teams_table', {})
          );
        }

        if (missingTables.includes('team_members')) {
          createTablesPromises.push(
            supabase.rpc('create_team_members_table', {})
          );
        }

        if (missingTables.includes('players')) {
          createTablesPromises.push(
            supabase.rpc('create_players_table', {})
          );
        }

        await Promise.all(createTablesPromises);

        res.json({
          success: true,
          message: `Created missing tables: ${missingTables.join(', ')}`
        });
      } else {
        res.json({
          success: true,
          message: 'All required tables exist'
        });
      }
    } catch (error) {
      console.error("Init DB error:", error);
      res.status(500).json({ error: "Failed to initialize database tables" });
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

  // Get team players
  app.get("/api/team/players", async (req, res) => {
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

      // Get players for the team
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', user.team_id);

      if (playersError) throw playersError;

      res.json({
        teamId: user.team_id,
        players: players || []
      });
    } catch (error) {
      console.error("Get team players error:", error);
      res.status(500).json({ error: "Failed to get team players" });
    }
  });
}

module.exports = { setupTeamRoutes };
