import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RankedTeam } from "@/lib/types";
import { useState } from "react";

export default function Leaderboard() {
  const [filterType, setFilterType] = useState<'all' | 'region' | 'friends'>('all');
  
  // Fetch leaderboard data
  const { data: leaderboard, isLoading } = useQuery<RankedTeam[]>({
    queryKey: ['/api/leaderboard'],
  });
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING LEADERBOARD...</div>
        <div className="text-gray-400">Please wait while we fetch the latest rankings</div>
      </div>
    );
  }
  
  const teams = leaderboard || [];
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h2 className="text-3xl font-burbank text-white mb-1">GLOBAL LEADERBOARD</h2>
          <p className="text-gray-400">Season 4 • Week 3 • Updated 3 hours ago</p>
        </div>
        <div className="mt-4 md:mt-0 space-x-2">
          <Button 
            variant={filterType === 'all' ? 'fortnite' : 'dark'} 
            size="sm"
            onClick={() => setFilterType('all')}
          >
            All Teams
          </Button>
          <Button 
            variant={filterType === 'region' ? 'fortnite' : 'dark'} 
            size="sm"
            onClick={() => setFilterType('region')}
          >
            My Region
          </Button>
          <Button 
            variant={filterType === 'friends' ? 'fortnite' : 'dark'} 
            size="sm"
            onClick={() => setFilterType('friends')}
          >
            Friends
          </Button>
        </div>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>TOP PERFORMING TEAMS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#333333]">
                  <th className="p-4 font-burbank text-gray-400">RANK</th>
                  <th className="p-4 font-burbank text-gray-400">TEAM</th>
                  <th className="p-4 font-burbank text-gray-400">POINTS</th>
                  <th className="p-4 font-burbank text-gray-400">WIN RATE</th>
                  <th className="p-4 font-burbank text-gray-400">MATCHES</th>
                  <th className="p-4 font-burbank text-gray-400"></th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr 
                    key={team.id} 
                    className={`border-b border-[#333333] ${
                      team.rank === 1 
                        ? 'bg-[#00F0B5] bg-opacity-5' 
                        : team.isUserTeam 
                          ? 'bg-[#2D0E75] bg-opacity-10' 
                          : ''
                    }`}
                  >
                    <td className="p-4">
                      <span className={`text-lg font-burbank ${
                        team.rank === 1 
                          ? 'text-[#00F0B5]' 
                          : team.rank <= 3 
                            ? 'text-yellow-400' 
                            : team.isUserTeam 
                              ? 'text-[#1890FF]' 
                              : 'text-white'
                      }`}>
                        #{team.rank}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-lg bg-[#1E1E1E] flex items-center justify-center mr-3">
                          <i className={`fas fa-${team.rank === 1 ? 'crown' : 'shield'} ${
                            team.rank === 1 
                              ? 'text-[#00F0B5]' 
                              : team.isUserTeam 
                                ? 'text-[#1890FF]' 
                                : 'text-gray-400'
                          }`}></i>
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {team.name} {team.isUserTeam && <span className="text-xs text-[#1890FF]">(Your Team)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-burbank text-white">{team.points.toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-white">{(Math.random() * 30 + 10).toFixed(1)}%</span>
                    </td>
                    <td className="p-4">
                      <span className="text-white">{Math.floor(Math.random() * 100 + 50)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="dark" size="sm">View Details</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
