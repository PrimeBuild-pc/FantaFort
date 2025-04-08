const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { setupAuthRoutes } = require('./auth-simple');
const { supabase } = require('./supabase');

// Create Express app
const app = express();

// Configure middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Set trust proxy for secure cookies in production
app.set('trust proxy', 1);

// Configure session
const sessionSettings = {
  secret: process.env.SESSION_SECRET || "fortnite-fantasy-session-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax"
  }
};

app.use(session(sessionSettings));

// Setup authentication routes
setupAuthRoutes(app);

// Setup basic API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// User profile route
app.get('/api/profile', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userId = req.user.id;
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return safe user data
    res.json({
      id: user.id,
      username: user.username,
      coins: user.coins,
      teamId: user.team_id,
      avatar: user.avatar,
      email: user.email,
      isPublicProfile: user.is_public_profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Team routes
app.get('/api/teams', async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*');

    if (error) throw error;

    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', req.params.teamId)
      .single();

    if (error) throw error;

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Players routes
app.get('/api/players', async (req, res) => {
  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('*');

    if (error) throw error;

    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/players/:playerId', async (req, res) => {
  try {
    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', req.params.playerId)
      .single();

    if (error) throw error;

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export the Express app
module.exports = app;
