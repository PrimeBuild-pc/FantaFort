import { setupRoutes } from '../server/routes';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { setupAuth } from '../server/auth';
import { initializeDatabase } from '../server/supabase-db';

// Create Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json());

// Configure session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Setup authentication
setupAuth(app);

// Initialize database
initializeDatabase().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Error initializing database:', err);
});

// Setup routes
setupRoutes(app);

// Export the Express app
export default app;
