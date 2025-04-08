import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
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
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/team" component={MyTeam} />
      <ProtectedRoute path="/leaderboard" component={Leaderboard} />
      <ProtectedRoute path="/marketplace" component={Marketplace} />
      <ProtectedRoute path="/tournaments" component={Tournaments} />
      <ProtectedRoute path="/tournament/:tournamentId" component={TournamentDetails} />
      <ProtectedRoute path="/tournament/:tournamentId/prize-pool" component={PrizePool} />
      <ProtectedRoute path="/player-stats/:id" component={PlayerStats} />
      <ProtectedRoute path="/game-management" component={GameManagement} />
      <ProtectedRoute path="/workshop" component={Workshop} />
      <ProtectedRoute path="/team-management" component={TeamManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Layout>
          <Router />
        </Layout>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
