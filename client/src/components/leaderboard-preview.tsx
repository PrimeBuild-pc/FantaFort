import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { RankedTeam } from "@/lib/types";

interface LeaderboardPreviewProps {
  teams: RankedTeam[];
}

export default function LeaderboardPreview({ teams }: LeaderboardPreviewProps) {
  return (
    <Card className="overflow-hidden mb-6">
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between items-center mb-4">
          <CardTitle>TOP TEAMS</CardTitle>
          <Link href="/leaderboard">
            <a className="text-xs text-[#00F0B5] hover:underline">View Full Leaderboard</a>
          </Link>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="space-y-3">
          {teams.map((team) => (
            <div 
              key={team.id}
              className={`flex items-center p-2 rounded-lg ${
                team.rank === 1 
                  ? 'bg-[#00F0B5] bg-opacity-10 border border-[#00F0B5] border-opacity-30' 
                  : team.isUserTeam 
                    ? 'bg-[#2D0E75] bg-opacity-20 border border-[#2D0E75] border-opacity-30' 
                    : 'bg-[#121212]'
              }`}
            >
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                <span className={`text-lg font-burbank ${
                  team.rank === 1 
                    ? 'text-[#00F0B5]' 
                    : team.isUserTeam 
                      ? 'text-[#1890FF]' 
                      : 'text-gray-400'
                }`}>
                  {team.rank}
                </span>
              </div>
              <div className="flex-grow ml-3">
                <div className="flex justify-between">
                  <h4 className="font-medium text-white">
                    {team.name} {team.isUserTeam && <span className="text-xs text-[#1890FF]">(You)</span>}
                  </h4>
                  <span className={`font-bold ${
                    team.rank === 1 
                      ? 'text-[#00F0B5]' 
                      : team.isUserTeam 
                        ? 'text-[#1890FF]' 
                        : 'text-gray-300'
                  }`}>
                    {team.points.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
