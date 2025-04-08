import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { User, FortnitePlayer, Team, TeamMember, RankedTeam, Tournament } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import PlayerCard from "@/components/player-card";
import EmptyPlayerSlot from "@/components/empty-player-slot";
import TeamStats from "@/components/team-stats";
import TeamOverview from "@/components/team-overview";
import LeaderboardPreview from "@/components/leaderboard-preview";
import TournamentCard from "@/components/tournament-card";

export default function Dashboard() {
  const { toast } = useToast();

  // Fetch current user
  const { data: user, isLoading: isLoadingUser } = useQuery<User | null>({
    queryKey: ['/api/user/current'],
  });

  // Fetch team roster
  const { data: players, isLoading: isLoadingPlayers } = useQuery<FortnitePlayer[]>({
    queryKey: ['/api/players'],
    enabled: !!user,
  });

  // Fetch team details
  const { data: team, isLoading: isLoadingTeam } = useQuery<Team>({
    queryKey: ['/api/team'],
    enabled: !!user && !!user.teamId,
  });

  // Fetch team members
  const { data: members, isLoading: isLoadingMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: !!team,
  });

  // Fetch leaderboard
  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useQuery<RankedTeam[]>({
    queryKey: ['/api/leaderboard'],
  });

  // Fetch tournaments
  const { data: tournaments, isLoading: isLoadingTournaments } = useQuery<Tournament[]>({
    queryKey: ['/api/tournaments'],
  });

  // Fetch performance data
  const { data: performanceData, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ['/api/team/performance'],
    enabled: !!team,
  });

  const handleAddPlayer = () => {
    // Navigate to the workshop page
    window.location.href = '/workshop';
  };

  const handleManageTeam = () => {
    // Navigate to the team management page
    window.location.href = '/team-management';
  };

  // Skip if loading
  if (isLoadingUser || isLoadingPlayers || isLoadingTeam || isLoadingMembers || isLoadingLeaderboard || isLoadingTournaments || isLoadingPerformance) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING FANTASY DASHBOARD...</div>
        <div className="text-gray-400">Please wait while we fetch your data</div>
      </div>
    );
  }

  const rosterPlayers = players || [];
  const totalSlots = 8;
  const filledSlots = rosterPlayers.length;
  const emptySlots = totalSlots - filledSlots;

  // Sample performance data if API didn't return it
  const weekData = performanceData?.weekData || [80, 120, 90, 160, 200, 240, 170];
  const monthData = performanceData?.monthData || [90, 140, 110, 180, 220, 260, 190];
  const seasonData = performanceData?.seasonData || [100, 150, 120, 190, 230, 280, 210];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h2 className="text-3xl font-burbank text-white mb-1">YOUR FANTASY DASHBOARD</h2>
            <p className="text-gray-400">Season 4 · Week 3 · Day 2</p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <Button variant="fortnite" className="btn-glow" onClick={handleAddPlayer}>
              <i className="fas fa-plus mr-2"></i> Add Player
            </Button>
            <Button variant="fortnite" className="btn-glow" onClick={handleManageTeam}>
              <i className="fas fa-users mr-2"></i> Manage Team
            </Button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Team Rank */}
          <Card className="fortnite-card rounded-xl p-4 flex items-center">
            <div className="bg-[#2D0E75] bg-opacity-20 rounded-lg p-3 mr-4">
              <i className="fas fa-trophy text-yellow-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Team Rank</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-burbank text-white">#{team?.rank || 42}</h3>
                <span className="ml-2 text-green-500 text-sm flex items-center">
                  <i className="fas fa-arrow-up mr-1"></i> 5
                </span>
              </div>
            </div>
          </Card>

          {/* Total Points */}
          <Card className="fortnite-card rounded-xl p-4 flex items-center">
            <div className="bg-[#1890FF] bg-opacity-20 rounded-lg p-3 mr-4">
              <i className="fas fa-chart-line text-[#1890FF] text-2xl"></i>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Points</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-burbank text-white">{team?.points.toLocaleString() || 1258}</h3>
                <span className="ml-2 text-green-500 text-sm flex items-center">
                  <i className="fas fa-arrow-up mr-1"></i> 124
                </span>
              </div>
            </div>
          </Card>

          {/* Next Match */}
          <Card className="fortnite-card rounded-xl p-4 flex items-center">
            <div className="bg-[#00F0B5] bg-opacity-20 rounded-lg p-3 mr-4">
              <i className="fas fa-clock text-[#00F0B5] text-2xl"></i>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Next Tournament</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-burbank text-white">4h 23m</h3>
                <span className="ml-2 text-[#00F0B5] text-sm">FNCS Finals</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Players Section */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-burbank text-white">YOUR ROSTER</h3>
            <div className="text-sm text-gray-400">
              <span className="text-[#00F0B5] font-medium">{filledSlots}/{totalSlots}</span> Players
            </div>
          </div>

          {/* Players List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rosterPlayers.map(player => (
              <PlayerCard key={player.id} player={player} />
            ))}

            {/* Empty slots */}
            {Array.from({ length: emptySlots }).map((_, index) => (
              <EmptyPlayerSlot
                key={`empty-${index}`}
                remainingSlots={emptySlots}
                onAddPlayer={handleAddPlayer}
              />
            ))}
          </div>

          {/* Team Performance Graph */}
          <TeamStats
            weeklyData={weekData}
            monthlyData={monthData}
            seasonData={seasonData}
          />
        </div>

        {/* Sidebar */}
        <div>
          {/* Team Overview */}
          {team && members && (
            <TeamOverview team={team} members={members || []} />
          )}

          {/* Leaderboard Preview */}
          {leaderboard && (
            <LeaderboardPreview teams={leaderboard.slice(0, 5)} />
          )}

          {/* Upcoming Tournaments */}
          {tournaments && (
            <TournamentCard tournaments={tournaments.slice(0, 2)} />
          )}
        </div>
      </div>
    </div>
  );
}
