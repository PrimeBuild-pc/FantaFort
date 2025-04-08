import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { FortnitePlayer } from "@/lib/types";
import { useWebSocket } from "@/hooks/use-websocket";
import { WebSocketMessageType } from "@/lib/websocket-types";

export default function Workshop() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("top500");
  const [selectedPlayers, setSelectedPlayers] = useState<FortnitePlayer[]>([]);
  const { socket, connected } = useWebSocket();

  // Fetch top 500 pro players
  const { data: topPlayers, isLoading: isLoadingTopPlayers } = useQuery<FortnitePlayer[]>({
    queryKey: ['/api/workshop/top-players'],
  });

  // Fetch user's team
  const { data: team, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['/api/team'],
  });

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handle player selection
  const handleSelectPlayer = (player: FortnitePlayer) => {
    if (selectedPlayers.some(p => p.id === player.id)) {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
    } else {
      if (selectedPlayers.length < 8) {
        setSelectedPlayers([...selectedPlayers, player]);
      } else {
        toast({
          title: "Team Full",
          description: "You can only select up to 8 players for your team.",
          variant: "destructive"
        });
      }
    }
  };

  // Handle adding players to team
  const handleAddToTeam = async () => {
    if (selectedPlayers.length === 0) {
      toast({
        title: "No Players Selected",
        description: "Please select at least one player to add to your team.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/team/add-players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerIds: selectedPlayers.map(p => p.id) }),
      });

      if (response.ok) {
        toast({
          title: "Players Added",
          description: `Successfully added ${selectedPlayers.length} players to your team.`,
          variant: "default"
        });
        setSelectedPlayers([]);
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to add players to team");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add players to team",
        variant: "destructive"
      });
    }
  };

  // Filter players based on search term
  const filteredPlayers = topPlayers ? topPlayers.filter(player => 
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // Listen for WebSocket updates
  useEffect(() => {
    if (socket && connected) {
      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === WebSocketMessageType.PLAYER_STATS_UPDATE) {
            // Handle player stats update
            toast({
              title: "Player Stats Updated",
              description: `${message.payload.playerName}'s stats have been updated.`,
              variant: "default"
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      socket.addEventListener("message", handleMessage);

      return () => {
        socket.removeEventListener("message", handleMessage);
      };
    }
  }, [socket, connected, toast]);

  // Loading state
  if (isLoadingTopPlayers || isLoadingTeam) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING WORKSHOP...</div>
        <div className="text-gray-400">Please wait while we fetch player data</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Workshop Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h2 className="text-3xl font-burbank text-white mb-1">PRO PLAYER WORKSHOP</h2>
            <p className="text-gray-400">Browse and select from the top Fortnite pro players</p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <Button 
              variant="fortnite" 
              className="btn-glow" 
              onClick={handleAddToTeam}
              disabled={selectedPlayers.length === 0}
            >
              <i className="fas fa-plus mr-2"></i> Add to Team ({selectedPlayers.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search players..."
            value={searchTerm}
            onChange={handleSearch}
            className="fortnite-input"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="top500" className="mb-6" onValueChange={setSelectedTab}>
        <TabsList className="fortnite-tabs">
          <TabsTrigger value="top500">Top 500</TabsTrigger>
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
        </TabsList>
        
        <TabsContent value="top500" className="mt-4">
          {/* Players Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPlayers.map(player => (
              <Card 
                key={player.id} 
                className={`fortnite-card p-4 cursor-pointer transition-all ${
                  selectedPlayers.some(p => p.id === player.id) ? 'border-[#00F0B5] border-2' : ''
                }`}
                onClick={() => handleSelectPlayer(player)}
              >
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden mr-3">
                    {player.avatar && (
                      <img 
                        src={player.avatar} 
                        alt={player.name} 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="text-white font-burbank">{player.name}</h4>
                    <p className="text-gray-400 text-sm">{player.team}</p>
                  </div>
                  <div className="ml-auto">
                    <div className="bg-[#2D0E75] bg-opacity-20 rounded-lg p-2">
                      <span className="text-[#00F0B5] font-burbank">{player.score || 85}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-800 bg-opacity-50 rounded p-2">
                    <p className="text-xs text-gray-400">Elims</p>
                    <p className="text-white font-medium">{player.eliminations}</p>
                  </div>
                  <div className="bg-gray-800 bg-opacity-50 rounded p-2">
                    <p className="text-xs text-gray-400">Win %</p>
                    <p className="text-white font-medium">{player.winRate}%</p>
                  </div>
                  <div className="bg-gray-800 bg-opacity-50 rounded p-2">
                    <p className="text-xs text-gray-400">K/D</p>
                    <p className="text-white font-medium">{player.kd}</p>
                  </div>
                </div>
                
                <div className="mt-3 flex justify-between items-center">
                  <div className="text-sm">
                    <span className="text-gray-400">Price: </span>
                    <span className="text-yellow-400">{player.price} coins</span>
                  </div>
                  <div className="text-xs px-2 py-1 rounded bg-blue-500 bg-opacity-20 text-blue-400">
                    {player.rarity || "COMMON"}
                  </div>
                </div>
              </Card>
            ))}
            
            {filteredPlayers.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-400">No players found matching your search criteria.</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="recommended" className="mt-4">
          <div className="text-center py-8">
            <p className="text-gray-400">Recommendations based on your team composition coming soon!</p>
          </div>
        </TabsContent>
        
        <TabsContent value="trending" className="mt-4">
          <div className="text-center py-8">
            <p className="text-gray-400">Trending players based on recent performances coming soon!</p>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Selected Players */}
      {selectedPlayers.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-burbank text-white mb-4">SELECTED PLAYERS</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {selectedPlayers.map(player => (
              <Card key={player.id} className="fortnite-card p-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden mr-3">
                    {player.avatar && (
                      <img 
                        src={player.avatar} 
                        alt={player.name} 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="text-white font-burbank">{player.name}</h4>
                    <p className="text-gray-400 text-xs">{player.team}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-auto text-red-500 hover:text-red-400 hover:bg-transparent"
                    onClick={() => handleSelectPlayer(player)}
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
