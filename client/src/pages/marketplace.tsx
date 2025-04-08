import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FortnitePlayer, Team } from "@/lib/types";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { queryClient } from "@/lib/queryClient";
import { useWebSocket, WebSocketMessage } from "@/hooks/use-websocket";

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<'all' | 'offense' | 'defense' | 'support'>('all');
  const { toast } = useToast();
  const [selectedPlayer, setSelectedPlayer] = useState<FortnitePlayer | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [recentActivity, setRecentActivity] = useState<{type: string, message: string, timestamp: Date} | null>(null);
  
  // Set up WebSocket connection
  const { messages, isConnected, isAuthenticated } = useWebSocket({
    onOpen: () => {
      console.log("WebSocket connected to marketplace");
    }
  });
  
  // Fetch available players for marketplace
  const { data: availablePlayers, isLoading } = useQuery<FortnitePlayer[]>({
    queryKey: ['/api/players/marketplace'],
  });

  // Fetch user's team 
  const { data: team } = useQuery<Team>({
    queryKey: ['/api/team'],
  });
  
  // Handle WebSocket messages
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      
      switch (latestMessage.type) {
        case 'PLAYER_ACQUIRED': {
          const { playerId, teamId, playerName, teamName } = latestMessage.payload;
          
          // Use provided names if available, otherwise use generic message
          const playerDisplayName = playerName || 'A player';
          const teamDisplayName = teamName || 'a team';
          
          setRecentActivity({
            type: 'ACQUISITION',
            message: `${playerDisplayName} was acquired by team ${teamDisplayName}`,
            timestamp: new Date()
          });
          
          // Refresh marketplace data
          queryClient.invalidateQueries({ queryKey: ['/api/players/marketplace'] });
          break;
        }
        case 'PLAYER_PRICE_UPDATE': {
          const { playerId, oldPrice, newPrice } = latestMessage.payload;
          
          // Get player name from current available players list
          const player = availablePlayers?.find(p => p.id === playerId);
          const playerName = player?.name || 'A player';
          
          setRecentActivity({
            type: 'PRICE_CHANGE',
            message: `${playerName}'s value ${newPrice > oldPrice ? 'increased' : 'decreased'} from ${oldPrice.toLocaleString()} to ${newPrice.toLocaleString()}`,
            timestamp: new Date()
          });
          
          // Refresh marketplace data
          queryClient.invalidateQueries({ queryKey: ['/api/players/marketplace'] });
          break;
        }
        case 'MARKET_UPDATE': {
          // Handle different market update types
          const { action, playerId, player, availablePlayers: availableCount } = latestMessage.payload;
          
          let message = '';
          
          if (action === 'PLAYER_REMOVED') {
            message = `A player has been removed from the marketplace. ${availableCount} players are now available.`;
          } else if (player) {
            message = `${player.name || 'A new player'} is now available in the marketplace!`;
          } else {
            message = 'The marketplace has been updated!';
          }
          
          setRecentActivity({
            type: 'MARKET_UPDATE',
            message,
            timestamp: new Date()
          });
          
          // Refresh marketplace data
          queryClient.invalidateQueries({ queryKey: ['/api/players/marketplace'] });
          break;
        }
        case 'PLAYER_TRANSFER': {
          const { playerId, fromTeamId, toTeamId } = latestMessage.payload;
          
          // Get player name from current available players list
          const player = availablePlayers?.find(p => p.id === playerId);
          const playerName = player?.name || 'A player';
          
          setRecentActivity({
            type: 'TRANSFER',
            message: `${playerName} has been transferred to a new team`,
            timestamp: new Date()
          });
          
          // Refresh marketplace data
          queryClient.invalidateQueries({ queryKey: ['/api/players/marketplace'] });
          break;
        }
        case 'NEW_NOTIFICATION': {
          // Optionally display notification toast based on notification ID
          // Could fetch notification details if needed
          queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
          break;
        }
        default:
          break;
      }
    }
  }, [messages, availablePlayers]);
  
  // Player acquisition mutation
  const acquirePlayerMutation = useMutation({
    mutationFn: async (playerId: string) => {
      const response = await fetch(`/api/players/${playerId}/acquire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to acquire player');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Player Acquired!",
        description: `${selectedPlayer?.name} has been added to your team.`,
      });
      setIsConfirmDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/players'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/marketplace'] });
    },
    onError: (error) => {
      toast({
        title: "Acquisition Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    }
  });
  
  const handleAcquirePlayer = (player: FortnitePlayer) => {
    if (!team) {
      toast({
        title: "No Team",
        description: "You need to create a team first before recruiting players.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedPlayer(player);
    setIsConfirmDialogOpen(true);
  };
  
  const confirmAcquirePlayer = () => {
    if (selectedPlayer) {
      acquirePlayerMutation.mutate(selectedPlayer.id);
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING MARKETPLACE...</div>
        <div className="text-gray-400">Please wait while we fetch available players</div>
      </div>
    );
  }
  
  const players = availablePlayers || [];
  
  // Filter players based on search query
  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         player.team.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    
    // Sample filters based on player stats
    if (filter === 'offense' && player.eliminations > 50) return matchesSearch;
    if (filter === 'defense' && player.winRate > 15) return matchesSearch;
    if (filter === 'support' && player.kd > 4) return matchesSearch;
    
    return false;
  });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h2 className="text-3xl font-burbank text-white mb-1">PLAYER MARKETPLACE</h2>
          <p className="text-gray-400">Find and acquire the best Fortnite players for your team</p>
        </div>
        <div className="flex items-center mt-4 md:mt-0 gap-2">
          {isConnected ? (
            <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Updates
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-yellow-900/20 text-yellow-400 border-yellow-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              Offline
            </Badge>
          )}
          
          {isConnected && (
            <Badge variant={isAuthenticated ? "outline" : "secondary"} 
              className={isAuthenticated 
                ? "bg-blue-900/20 text-blue-400 border-blue-800 flex items-center gap-1"
                : "bg-gray-800/40 text-gray-400 border-gray-700 flex items-center gap-1"
              }
            >
              {isAuthenticated ? "Authenticated" : "Anonymous"}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="bg-[#1E1E1E] border-[#333] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-burbank text-[#00F0B5]">CONFIRM ACQUISITION</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to acquire this player for your team?
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlayer && (
            <div className="flex items-center space-x-4 my-4 p-3 bg-[#2A2A2A] rounded-lg">
              <img 
                src={selectedPlayer.avatar || "https://via.placeholder.com/60"} 
                alt={selectedPlayer.name} 
                className="w-16 h-16 rounded-full border-2 border-[#1890FF]"
              />
              <div>
                <h4 className="text-lg font-burbank text-white">{selectedPlayer.name}</h4>
                <p className="text-sm text-gray-400">Team: {selectedPlayer.team}</p>
                <div className="flex items-center mt-1">
                  <span className="text-[#00F0B5] font-medium">{(selectedPlayer.points * 5).toLocaleString()}</span>
                  <i className="fas fa-coins ml-2 text-yellow-400 text-xs"></i>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsConfirmDialogOpen(false)}
              className="border-[#333] text-gray-300 hover:bg-[#333] hover:text-white"
            >
              Cancel
            </Button>
            <Button 
              variant="fortnite"
              onClick={confirmAcquirePlayer}
              disabled={acquirePlayerMutation.isPending}
              className="btn-glow"
            >
              {acquirePlayerMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Processing...
                </>
              ) : (
                "Confirm Acquisition"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Recent activity notification */}
      {recentActivity && (
        <Alert className="mb-4 border-purple-800 bg-purple-900/20 text-purple-200">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-700">
              {recentActivity.type === 'ACQUISITION' 
                ? 'PLAYER ACQUIRED' 
                : recentActivity.type === 'PRICE_CHANGE' 
                  ? 'PRICE CHANGED'
                  : recentActivity.type === 'TRANSFER'
                    ? 'PLAYER TRANSFERRED'
                    : 'MARKET UPDATE'}
            </Badge>
            <span className="text-xs text-gray-400">
              {new Date(recentActivity.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <AlertDescription className="mt-1">
            {recentActivity.message}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Search and filters */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-6">
              <Input 
                placeholder="Search players or teams..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#1E1E1E] border-[#333333]"
              />
            </div>
            <div className="md:col-span-6 flex flex-wrap gap-2">
              <Button 
                variant={filter === 'all' ? 'fortnite' : 'dark'} 
                size="sm"
                onClick={() => setFilter('all')}
              >
                All Players
              </Button>
              <Button 
                variant={filter === 'offense' ? 'fortnite' : 'dark'} 
                size="sm"
                onClick={() => setFilter('offense')}
              >
                Top Fraggers
              </Button>
              <Button 
                variant={filter === 'defense' ? 'fortnite' : 'dark'} 
                size="sm"
                onClick={() => setFilter('defense')}
              >
                High Win Rate
              </Button>
              <Button 
                variant={filter === 'support' ? 'fortnite' : 'dark'} 
                size="sm"
                onClick={() => setFilter('support')}
              >
                Best K/D
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Player listings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map((player) => (
            <Card key={player.id} className="overflow-hidden hover:shadow-[0_0_15px_rgba(45,14,117,0.5)] transition-shadow duration-300">
              <div className="flex items-center p-4">
                <div className="relative mr-3">
                  <img 
                    src={player.avatar || "https://via.placeholder.com/60"}
                    alt={`${player.name} avatar`}
                    className="w-14 h-14 rounded-full object-cover border-2 border-[#1890FF]"
                  />
                </div>
                <div>
                  <h4 className="font-burbank text-xl text-white">{player.name}</h4>
                  <p className="text-sm text-gray-400">Team: {player.team}</p>
                </div>
              </div>
              
              <div className="p-4 pt-0">
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                  <div className="bg-[#121212] bg-opacity-50 rounded p-2">
                    <p className="text-gray-400">Elims</p>
                    <p className="text-white font-medium text-base">{player.eliminations}</p>
                  </div>
                  <div className="bg-[#121212] bg-opacity-50 rounded p-2">
                    <p className="text-gray-400">Win Rate</p>
                    <p className="text-white font-medium text-base">{player.winRate}%</p>
                  </div>
                  <div className="bg-[#121212] bg-opacity-50 rounded p-2">
                    <p className="text-gray-400">K/D</p>
                    <p className="text-white font-medium text-base">{player.kd}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-2">
                  <div>
                    <span className="text-xl font-burbank text-[#00F0B5]">{(player.points * 5).toLocaleString()}</span>
                    <i className="fas fa-coins ml-2 text-yellow-400"></i>
                  </div>
                  <Button 
                    variant="fortnite"
                    size="sm" 
                    onClick={() => handleAcquirePlayer(player)}
                  >
                    Acquire Player
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <div className="w-16 h-16 mx-auto bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4">
              <i className="fas fa-search text-gray-500 text-xl"></i>
            </div>
            <h3 className="text-lg text-white mb-2">No players found</h3>
            <p className="text-gray-400">Try adjusting your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
