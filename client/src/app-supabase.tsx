import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import SupabaseAuthPage from "@/pages/supabase-auth-page";
import MyTeam from "@/pages/my-team";
import Leaderboard from "@/pages/leaderboard";
import Marketplace from "@/pages/marketplace";
import Tournaments from "@/pages/tournaments";
import TournamentDetails from "@/pages/tournament-details";
import PlayerStats from "@/pages/player-stats";
import GameManagement from "@/pages/game-management";
import Workshop from "@/pages/workshop";
import TeamManagement from "@/pages/team-management";
import PrizePool from "@/pages/prize-pool";
import { SupabaseProtectedRoute } from "./lib/supabase-protected-route";
import { SupabaseAuthProvider } from "./hooks/use-supabase-auth";

function Router() {
  return (
    <Switch>
      <SupabaseProtectedRoute path="/" component={Dashboard} />
      <Route path="/auth" component={SupabaseAuthPage} />
      <SupabaseProtectedRoute path="/team" component={MyTeam} />
      <SupabaseProtectedRoute path="/leaderboard" component={Leaderboard} />
      <SupabaseProtectedRoute path="/marketplace" component={Marketplace} />
      <SupabaseProtectedRoute path="/tournaments" component={Tournaments} />
      <SupabaseProtectedRoute path="/tournament/:tournamentId" component={TournamentDetails} />
      <SupabaseProtectedRoute path="/tournament/:tournamentId/prize-pool" component={PrizePool} />
      <SupabaseProtectedRoute path="/player-stats/:id" component={PlayerStats} />
      <SupabaseProtectedRoute path="/game-management" component={GameManagement} />
      <SupabaseProtectedRoute path="/workshop" component={Workshop} />
      <SupabaseProtectedRoute path="/team-management" component={TeamManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        <Layout>
          <Router />
        </Layout>
        <Toaster />
      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
