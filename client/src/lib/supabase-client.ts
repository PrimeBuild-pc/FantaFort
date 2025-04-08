import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabaseUrl = 'https://nxrqxozgbjiegjqgjypa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnF4b3pnYmppZWdqcWdqeXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMDcyNTgsImV4cCI6MjA1OTY4MzI1OH0.se5REjhJrxPW_7hSKNvdeJ_IW09OPs1iTOrM8FKZ67s';

// Log the Supabase configuration
console.log('Supabase configuration:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Test the Supabase connection
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Supabase auth state changed:', { event, session: session ? 'exists' : 'null' });
});
