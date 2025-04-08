// Serverless API entry point for Vercel deployment
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { setupAuthRoutes } from './auth-simple.js';
import { setupTeamRoutes } from './team.js';
import { setupPrizePoolRoutes } from './prize-pool.js';
import { supabase } from './supabase.js';

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

// Setup team routes
setupTeamRoutes(app);

// Setup prize pool routes
setupPrizePoolRoutes(app);

// Setup basic API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create serverless handler
export default function handler(req, res) {
  // Forward the request to the Express app
  app(req, res);
}
