import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@shared/schema';
import { supabase, supabaseAdmin, initializeSupabaseTables } from './supabase';

// Initialize Drizzle with the schema
export const db = drizzle(supabaseAdmin, { schema });

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
