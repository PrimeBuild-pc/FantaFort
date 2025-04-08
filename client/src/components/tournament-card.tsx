import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tournament } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface TournamentCardProps {
  tournaments: Tournament[];
}

export default function TournamentCard({ tournaments }: TournamentCardProps) {
  const { toast } = useToast();
  
  const handleRegister = (tournamentId: string) => {
    toast({
      title: "Coming Soon",
      description: "Tournament registration will be available in the next update.",
    });
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 pb-0">
        <CardTitle>UPCOMING TOURNAMENTS</CardTitle>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="space-y-4">
          {tournaments.map((tournament) => (
            <div 
              key={tournament.id}
              className={`p-3 rounded-lg ${
                tournament.type === 'MAJOR' 
                  ? 'bg-gradient-to-r from-[#2D0E75] to-[#1890FF] bg-opacity-20' 
                  : 'bg-[#1E1E1E]'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-burbank text-white">{tournament.name}</h4>
                  <p className="text-xs text-gray-300 mt-1">{tournament.date} • {tournament.time}</p>
                </div>
                <div className={`${
                  tournament.type === 'MAJOR' 
                    ? 'bg-[#00F0B5] bg-opacity-20 text-[#00F0B5]' 
                    : 'bg-gray-500 bg-opacity-20 text-gray-300'
                } rounded-full px-2 py-1 text-xs font-medium`}>
                  {tournament.type}
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center text-xs">
                  <i className="fas fa-trophy text-yellow-400 mr-2"></i>
                  <span className="text-gray-300">Prize Pool: </span>
                  <span className="text-white font-medium ml-1">${tournament.prizePool.toLocaleString()}</span>
                </div>
                <div className="mt-2 flex items-center text-xs">
                  <i className="fas fa-users text-gray-400 mr-2"></i>
                  <span className="text-gray-300">Teams Registered: </span>
                  <span className="text-white font-medium ml-1">{tournament.registeredTeams}/{tournament.maxTeams}</span>
                </div>
              </div>
              <div className="mt-3">
                <Button 
                  variant={tournament.type === 'MAJOR' ? 'dark' : 'fortnite'}
                  className="w-full"
                  size="sm"
                  onClick={() => handleRegister(tournament.id)}
                >
                  Register Team
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
