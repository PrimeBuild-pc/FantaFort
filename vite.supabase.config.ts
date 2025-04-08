import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'client',  // Simplified path to client directory
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  build: {
    outDir: '../dist/public',  // Relative to root
    emptyOutDir: true,
  },
  define: {
    'process.env.VITE_SUPABASE_URL': JSON.stringify('https://nxrqxozgbjiegjqgjypa.supabase.co'),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnF4b3pnYmppZWdqcWdqeXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMDcyNTgsImV4cCI6MjA1OTY4MzI1OH0.se5REjhJrxPW_7hSKNvdeJ_IW09OPs1iTOrM8FKZ67s'),
  },
});
