import AppShell from './shell';

// Game state, the Supabase client and its polling load only for the app routes;
// the public marketing, guide, player and legal pages stay light.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
