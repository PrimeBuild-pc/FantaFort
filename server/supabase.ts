import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/supabase-types';

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://nxrqxozgbjiegjqgjypa.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnF4b3pnYmppZWdqcWdqeXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMDcyNTgsImV4cCI6MjA1OTY4MzI1OH0.se5REjhJrxPW_7hSKNvdeJ_IW09OPs1iTOrM8FKZ67s';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnF4b3pnYmppZWdqcWdqeXBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEwNzI1OCwiZXhwIjoyMDU5NjgzMjU4fQ.y2HCPPpdQpXD87qRsOkkmDuRm4PKro_a5b1BWw78qhc';

// Create Supabase client with anonymous key (for client-side usage)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Create Supabase admin client with service key (for server-side usage)
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Initialize Supabase tables based on the schema
 * This function should be called during application startup
 */
export async function initializeSupabaseTables() {
  try {
    console.log('Initializing Supabase tables...');
    
    // Check if tables exist, create them if they don't
    const { error: usersError } = await supabaseAdmin.rpc('check_and_create_table', {
      table_name: 'users',
      create_statement: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          coins INTEGER NOT NULL DEFAULT 1000,
          team_id TEXT,
          avatar TEXT,
          email TEXT,
          is_public_profile BOOLEAN DEFAULT FALSE
        )
      `
    });
    
    if (usersError) throw usersError;
    
    // Create teams table
    const { error: teamsError } = await supabaseAdmin.rpc('check_and_create_table', {
      table_name: 'teams',
      create_statement: `
        CREATE TABLE IF NOT EXISTS teams (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          owner_id INTEGER NOT NULL REFERENCES users(id),
          rank INTEGER NOT NULL DEFAULT 999,
          points INTEGER NOT NULL DEFAULT 0,
          logo TEXT,
          is_public BOOLEAN DEFAULT TRUE,
          description TEXT
        )
      `
    });
    
    if (teamsError) throw teamsError;
    
    // Create players table
    const { error: playersError } = await supabaseAdmin.rpc('check_and_create_table', {
      table_name: 'players',
      create_statement: `
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          team TEXT NOT NULL,
          avatar TEXT,
          points INTEGER NOT NULL DEFAULT 0,
          price INTEGER NOT NULL DEFAULT 100,
          rarity TEXT NOT NULL DEFAULT 'COMMON',
          role TEXT NOT NULL DEFAULT 'FLEX',
          user_id INTEGER REFERENCES users(id),
          team_id TEXT REFERENCES teams(id),
          is_team_captain BOOLEAN DEFAULT FALSE,
          eliminations INTEGER NOT NULL DEFAULT 0,
          win_rate INTEGER NOT NULL DEFAULT 0,
          kd INTEGER NOT NULL DEFAULT 0,
          accuracy INTEGER,
          build_speed INTEGER,
          clutch_factor INTEGER,
          consistency INTEGER,
          tournaments INTEGER,
          avg_placement INTEGER,
          last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          historical_performance TEXT,
          weekly_points INTEGER DEFAULT 0,
          monthly_points INTEGER DEFAULT 0,
          season_points INTEGER DEFAULT 0,
          season_trend TEXT DEFAULT 'STABLE'
        )
      `
    });
    
    if (playersError) throw playersError;
    
    // Create other tables as needed...
    
    console.log('Supabase tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Supabase tables:', error);
    return false;
  }
}
