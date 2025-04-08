import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { setupAuth } from '../server/auth';
import { storage } from '../server/storage';
import { supabaseStorage } from '../server/supabase-storage';
import { initializeDatabase } from '../server/supabase-db';
import { setupPlayerRoutes } from '../server/player-routes';
import { setupTournamentRoutes } from '../server/tournament-routes';

// Create Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json());

// Set trust proxy for secure cookies in production
app.set('trust proxy', 1);

// Configure session
const sessionSettings = {
  secret: process.env.SESSION_SECRET || "fortnite-fantasy-session-secret-key",
  resave: false,
  saveUninitialized: false,
  store: supabaseStorage.sessionStore,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax"
  }
};

app.use(session(sessionSettings));

// Setup authentication
setupAuth(app);

// Initialize database
initializeDatabase().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Error initializing database:', err);
});

// Setup player routes
setupPlayerRoutes(app);

// Setup tournament routes
setupTournamentRoutes(app);

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
    const user = await supabaseStorage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return safe user data
    res.json({
      id: user.id,
      username: user.username,
      coins: user.coins,
      teamId: user.teamId,
      avatar: user.avatar,
      email: user.email,
      isPublicProfile: user.isPublicProfile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Team routes
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await supabaseStorage.getTeams();
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const team = await supabaseStorage.getTeamById(req.params.teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export the Express app
export default app;
