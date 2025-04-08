import { useQuery } from "@tanstack/react-query";
import { Tournament, WebSocketMessageType } from "@/lib/types";
import TournamentRegistration from "@/components/tournament-registration";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/use-websocket";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Tournaments() {
  const [filter, setFilter] = useState<'all' | 'major' | 'minor'>('all');
  const [recentActivity, setRecentActivity] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Setup WebSocket connection
  const { messages, isConnected, isAuthenticated } = useWebSocket();
  
  // Fetch tournaments
  const { data: tournaments, isLoading } = useQuery<Tournament[]>({
    queryKey: ['/api/tournaments'],
  });
  
  // Handle WebSocket messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Handle different message types related to tournaments
      switch (lastMessage.type) {
        case WebSocketMessageType.TOURNAMENT_REGISTRATION:
          // Someone registered for a tournament
          const regPayload = lastMessage.payload;
          const teamName = regPayload.teamName || 'A team';
          setRecentActivity(`${teamName} just registered for a tournament!`);
          queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
          toast({
            title: "Tournament Registration",
            description: `${teamName} has registered for a tournament.`,
          });
          break;
          
        case WebSocketMessageType.TOURNAMENT_UPDATE:
          // Tournament updated (registrations, status, etc.)
          queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
          break;
          
        case WebSocketMessageType.NEW_NOTIFICATION:
          // Check if we need to update anything based on notification
          // For now, just invalidate tournaments query
          queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
          break;
      }
    }
  }, [messages, toast]);
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING TOURNAMENTS...</div>
        <div className="text-gray-400">Please wait while we fetch tournament information</div>
      </div>
    );
  }
  
  const tournamentsList = tournaments || [];
  
  // Filter tournaments
  const filteredTournaments = tournamentsList.filter(tournament => {
    if (filter === 'all') return true;
    if (filter === 'major') return tournament.type === 'MAJOR';
    if (filter === 'minor') return tournament.type === 'MINOR';
    return true;
  });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h2 className="text-3xl font-burbank text-white mb-1">TOURNAMENTS</h2>
          <p className="text-gray-400">Compete in tournaments to win prizes and climb the leaderboard</p>
        </div>
        
        {/* WebSocket Status */}
        <div className="mt-4 md:mt-0 flex flex-col items-end">
          <div className="flex items-center mb-1">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
              {isAuthenticated && isConnected && ' (Authenticated)'}
            </span>
          </div>
          {recentActivity && (
            <div className="bg-[#1a1a1a] p-2 rounded-md">
              <p className="text-xs text-[#00F0B5]">{recentActivity}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Tournament filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Button 
          variant={filter === 'all' ? 'fortnite' : 'dark'} 
          size="sm"
          onClick={() => setFilter('all')}
        >
          All Tournaments
        </Button>
        <Button 
          variant={filter === 'major' ? 'fortnite' : 'dark'} 
          size="sm"
          onClick={() => setFilter('major')}
        >
          Major Events
        </Button>
        <Button 
          variant={filter === 'minor' ? 'fortnite' : 'dark'} 
          size="sm"
          onClick={() => setFilter('minor')}
        >
          Minor Events
        </Button>
      </div>
      
      {/* Tournament listings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTournaments.length > 0 ? (
          filteredTournaments.map((tournament) => (
            <TournamentRegistration key={tournament.id} tournament={tournament} />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <div className="w-16 h-16 mx-auto bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4">
              <i className="fas fa-trophy text-gray-500 text-xl"></i>
            </div>
            <h3 className="text-lg text-white mb-2">No tournaments found</h3>
            <p className="text-gray-400">There are no tournaments matching your filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}