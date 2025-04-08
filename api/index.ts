import { setupRoutes } from '../server/routes';
import express from 'express';
import cors from 'cors';
import { setupAuth } from '../server/auth';
import { initializeDatabase } from '../server/supabase-db';
import { storage } from '../server/storage';

// Create Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json());

// Set trust proxy for secure cookies in production
app.set('trust proxy', 1);

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
