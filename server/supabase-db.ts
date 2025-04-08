import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '@shared/schema';
import { supabase, supabaseAdmin, initializeSupabaseTables } from './supabase';

// Supabase connection URL
const connectionString = process.env.SUPABASE_POSTGRES_URL || 
  `postgres://postgres.nxrqxozgbjiegjqgjypa:${process.env.SUPABASE_SERVICE_KEY}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`;

// Create a PostgreSQL client
const client = postgres(connectionString, {
  ssl: 'require',
  max: 10, // Connection pool size
});

// Initialize Drizzle with the client and schema
export const db = drizzle(client, { schema });

/**
 * Initialize the database
 * This function should be called during application startup
 */
export async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Initialize Supabase tables
    await initializeSupabaseTables();
    
    // Run Drizzle migrations
    // await migrate(db, { migrationsFolder: './migrations' });
    
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// Export Supabase clients for direct access
export { supabase, supabaseAdmin };
