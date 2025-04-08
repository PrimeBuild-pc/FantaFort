import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: './client',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    'process.env.VITE_SUPABASE_URL': JSON.stringify('https://nxrqxozgbjiegjqgjypa.supabase.co'),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnF4b3pnYmppZWdqcWdqeXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMDcyNTgsImV4cCI6MjA1OTY4MzI1OH0.se5REjhJrxPW_7hSKNvdeJ_IW09OPs1iTOrM8FKZ67s'),
  },
});
