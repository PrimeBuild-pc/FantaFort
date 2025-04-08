import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FortnitePlayer, User, PerformanceHistory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Share2, 
  TrendingUp, 
  Shield, 
  Target, 
  Calendar, 
  Clock, 
  User as UserIcon,
  Lock, 
  Unlock
} from "lucide-react";

export default function PlayerStats() {
  const [_, setLocation] = useLocation();
  const params = useParams();
  const playerId = params?.id;
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [shareExpiry, setShareExpiry] = useState("7");
  const [shareAccesses, setShareAccesses] = useState("0");
  
  // Fetch player data
  const { 
    data: player, 
    isLoading: isLoadingPlayer,
    error: playerError
  } = useQuery<FortnitePlayer>({
    queryKey: ['/api/players', playerId],
    enabled: !!playerId,
  });

  // Fetch player performance data (weekly/monthly/all-time)
  const { 
    data: performanceHistory, 
    isLoading: isLoadingPerformance 
  } = useQuery<PerformanceHistory[]>({
    queryKey: ['/api/performance-history/player', playerId],
    enabled: !!playerId,
  });
  
  // Fetch pending access requests
  const { 
    data: accessRequests,
    isLoading: isLoadingRequests
  } = useQuery({
    queryKey: ['/api/access-requests/pending'],
  });
  
  // Create stats share mutation
  const createShareMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/stats/share', data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Stats Share Created",
        description: `Share code: ${data.shareCode}`,
      });
      setShareDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Share",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });
  
  // Create access request mutation
  const requestAccessMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/access-requests', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Access Request Sent",
        description: "Your request has been sent to the player owner",
      });
      setAccessDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Request",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });
  
  // Respond to access request mutation
  const respondToRequestMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number, status: string }) => {
      const response = await apiRequest('PUT', `/api/access-requests/${requestId}`, { status });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/access-requests/pending'] });
      toast({
        title: "Request Updated",
        description: "The access request has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Request",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });
  
  // Handle share stats
  const handleShareStats = () => {
    if (!player) return;
    
    const expiryDate = shareExpiry === "0" 
      ? null 
      : new Date(Date.now() + parseInt(shareExpiry) * 24 * 60 * 60 * 1000);
    
    createShareMutation.mutate({
      playerId: player.id,
      expiresAt: expiryDate,
      maxAccesses: shareAccesses === "0" ? null : parseInt(shareAccesses),
    });
  };
  
  // Handle request access
  const handleRequestAccess = (message: string) => {
    if (!playerId) return;
    
    requestAccessMutation.mutate({
      targetId: playerId,
      targetType: "PLAYER",
      message,
    });
  };
  
  // Handle access request response
  const handleAccessResponse = (requestId: number, status: 'APPROVED' | 'DENIED') => {
    respondToRequestMutation.mutate({
      requestId,
      status,
    });
  };
  
  // Format performance data for charts
  const formatPerformanceData = () => {
    if (!performanceHistory) return [];
    
    return performanceHistory.map(record => ({
      date: new Date(record.date).toLocaleDateString(),
      points: record.points,
      eliminations: record.eliminations,
      winRate: record.winRate,
      kd: record.kd,
    }));
  };
  
  // Loading state
  if (isLoadingPlayer || isLoadingPerformance) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING PLAYER DATA...</div>
        <div className="text-gray-400">Please wait while we fetch player information</div>
      </div>
    );
  }
  
  // Error state
  if (playerError || !player) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4">PLAYER NOT FOUND</div>
        <div className="text-gray-400 mb-6">The player you're looking for doesn't exist or you don't have access</div>
        <Button 
          variant="dark" 
          onClick={() => setLocation('/marketplace')}
        >
          Back to Marketplace
        </Button>
        
        {/* Access Request Dialog */}
        <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="fortnite" className="ml-4">
              <Lock className="w-4 h-4 mr-2" />
              Request Access
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1E1E1E] border-[#333] text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-burbank text-[#00F0B5]">REQUEST ACCESS</DialogTitle>
              <DialogDescription className="text-gray-400">
                Request access to view this player's statistics
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <Label htmlFor="message" className="text-gray-300">Message (Optional)</Label>
              <Input 
                id="message"
                placeholder="Enter a message for the player owner" 
                className="bg-[#121212] border-[#333] text-white mt-2"
              />
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setAccessDialogOpen(false)}
                className="border-[#333] text-gray-300 hover:bg-[#333] hover:text-white"
              >
                Cancel
              </Button>
              <Button 
                variant="fortnite"
                onClick={() => handleRequestAccess("")}
                disabled={requestAccessMutation.isPending}
                className="btn-glow"
              >
                {requestAccessMutation.isPending ? (
                  <span>Sending...</span>
                ) : (
                  <span>Send Request</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  
  const performanceData = formatPerformanceData();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <div className="flex items-center mb-2">
            <h2 className="text-3xl font-burbank text-white mr-3">{player.name}</h2>
            {player.isTeamCaptain && (
              <Badge className="bg-[#FFCA28] text-black">Team Captain</Badge>
            )}
          </div>
          <p className="text-gray-400">
            Team: {player.team} • 
            Rating: {player.points} • 
            Last Updated: {player.lastUpdated}
          </p>
        </div>
        <div className="flex mt-4 md:mt-0 space-x-2">
          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="dark">
                <Share2 className="h-4 w-4 mr-2" />
                Share Stats
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1E1E1E] border-[#333] text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-burbank text-[#00F0B5]">SHARE PLAYER STATS</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Create a shareable link to this player's stats
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4 space-y-4">
                <div>
                  <Label htmlFor="expiry" className="text-gray-300">Link Expiry</Label>
                  <Select value={shareExpiry} onValueChange={setShareExpiry}>
                    <SelectTrigger className="bg-[#121212] border-[#333] text-white mt-2">
                      <SelectValue placeholder="Select Expiry" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1E1E1E] border-[#333] text-white">
                      <SelectItem value="1">1 Day</SelectItem>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="0">Never Expires</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="accesses" className="text-gray-300">Max Accesses</Label>
                  <Select value={shareAccesses} onValueChange={setShareAccesses}>
                    <SelectTrigger className="bg-[#121212] border-[#333] text-white mt-2">
                      <SelectValue placeholder="Select Max Accesses" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1E1E1E] border-[#333] text-white">
                      <SelectItem value="1">1 Access</SelectItem>
                      <SelectItem value="5">5 Accesses</SelectItem>
                      <SelectItem value="10">10 Accesses</SelectItem>
                      <SelectItem value="0">Unlimited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setShareDialogOpen(false)}
                  className="border-[#333] text-gray-300 hover:bg-[#333] hover:text-white"
                >
                  Cancel
                </Button>
                <Button 
                  variant="fortnite"
                  onClick={handleShareStats}
                  disabled={createShareMutation.isPending}
                  className="btn-glow"
                >
                  {createShareMutation.isPending ? (
                    <span>Creating...</span>
                  ) : (
                    <span>Create Share Link</span>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="fortnite" 
            onClick={() => setLocation('/marketplace')}
          >
            View Marketplace
          </Button>
        </div>
      </div>
      
      {/* Player Profile Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <img 
                  src={player.avatar || "https://via.placeholder.com/100"}
                  alt={player.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#FFCA28] mr-4"
                />
                <div>
                  <h3 className="text-xl font-burbank text-white">{player.name}</h3>
                  <p className="text-gray-400">Team: {player.team}</p>
                  <div className="flex items-center mt-1">
                    <Badge className="bg-[#2D0E75]">{player.points} Points</Badge>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-[#121212] bg-opacity-50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Target className="h-5 w-5 text-[#FFCA28] mr-2" />
                    <span className="text-gray-400">Eliminations</span>
                  </div>
                  <div className="text-2xl font-burbank text-white">{player.stats.eliminations}</div>
                </div>
                
                <div className="bg-[#121212] bg-opacity-50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Shield className="h-5 w-5 text-[#FFCA28] mr-2" />
                    <span className="text-gray-400">Win Rate</span>
                  </div>
                  <div className="text-2xl font-burbank text-white">{player.stats.winRate}%</div>
                </div>
                
                <div className="bg-[#121212] bg-opacity-50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="h-5 w-5 text-[#FFCA28] mr-2" />
                    <span className="text-gray-400">K/D Ratio</span>
                  </div>
                  <div className="text-2xl font-burbank text-white">{player.stats.kd}</div>
                </div>
                
                <div className="bg-[#121212] bg-opacity-50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Calendar className="h-5 w-5 text-[#FFCA28] mr-2" />
                    <span className="text-gray-400">Season Score</span>
                  </div>
                  <div className="text-2xl font-burbank text-white">{player.points * 5}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Access Requests */}
          {accessRequests && accessRequests.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>ACCESS REQUESTS</CardTitle>
                <CardDescription>Players requesting access to your stats</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {accessRequests.map((request: any) => (
                    <div key={request.id} className="bg-[#121212] p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-white font-medium">User #{request.requestorId}</span>
                      </div>
                      {request.message && (
                        <p className="text-gray-400 text-sm mb-3">"{request.message}"</p>
                      )}
                      <div className="text-xs text-gray-500 mb-3">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {new Date(request.requestedAt).toLocaleString()}
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="dark" 
                          size="sm"
                          onClick={() => handleAccessResponse(request.id, 'DENIED')}
                          className="flex-1"
                        >
                          Deny
                        </Button>
                        <Button 
                          variant="fortnite" 
                          size="sm"
                          onClick={() => handleAccessResponse(request.id, 'APPROVED')}
                          className="flex-1"
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Performance Charts */}
        <div className="lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>PERFORMANCE STATISTICS</CardTitle>
              <CardDescription>Player performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="points">
                <TabsList className="mb-6">
                  <TabsTrigger value="points">Points</TabsTrigger>
                  <TabsTrigger value="eliminations">Eliminations</TabsTrigger>
                  <TabsTrigger value="winrate">Win Rate</TabsTrigger>
                  <TabsTrigger value="kd">K/D Ratio</TabsTrigger>
                </TabsList>
                
                <TabsContent value="points">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceData}>
                        <defs>
                          <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00F0B5" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#00F0B5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#999" />
                        <YAxis stroke="#999" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1E1E1E', 
                            borderColor: '#333',
                            color: 'white' 
                          }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="points" 
                          stroke="#00F0B5" 
                          fillOpacity={1} 
                          fill="url(#colorPoints)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                
                <TabsContent value="eliminations">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#999" />
                        <YAxis stroke="#999" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1E1E1E', 
                            borderColor: '#333',
                            color: 'white' 
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="eliminations" 
                          stroke="#FF6B6B" 
                          strokeWidth={2}
                          dot={{ fill: '#FF6B6B', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                
                <TabsContent value="winrate">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#999" />
                        <YAxis stroke="#999" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1E1E1E', 
                            borderColor: '#333',
                            color: 'white' 
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="winRate" 
                          stroke="#FFCA28" 
                          strokeWidth={2}
                          dot={{ fill: '#FFCA28', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                
                <TabsContent value="kd">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#999" />
                        <YAxis stroke="#999" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1E1E1E', 
                            borderColor: '#333',
                            color: 'white' 
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="kd" 
                          stroke="#4D8DFF" 
                          strokeWidth={2}
                          dot={{ fill: '#4D8DFF', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          {/* Weekly Performance Summary */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>WEEKLY SUMMARY</CardTitle>
              <CardDescription>Performance over the last 4 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-[#121212]">
                  <CardContent className="p-4 text-center">
                    <div className="text-gray-400 mb-1">Week 1</div>
                    <div className="text-2xl font-burbank text-white">
                      {player.points * 0.85} pts
                    </div>
                    <div className="text-xs text-[#00F0B5]">
                      +5.2% from previous
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-[#121212]">
                  <CardContent className="p-4 text-center">
                    <div className="text-gray-400 mb-1">Week 2</div>
                    <div className="text-2xl font-burbank text-white">
                      {player.points * 0.9} pts
                    </div>
                    <div className="text-xs text-[#00F0B5]">
                      +8.3% from previous
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-[#121212]">
                  <CardContent className="p-4 text-center">
                    <div className="text-gray-400 mb-1">Week 3</div>
                    <div className="text-2xl font-burbank text-white">
                      {player.points * 0.95} pts
                    </div>
                    <div className="text-xs text-[#00F0B5]">
                      +3.1% from previous
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-[#121212]">
                  <CardContent className="p-4 text-center">
                    <div className="text-gray-400 mb-1">Week 4 (Current)</div>
                    <div className="text-2xl font-burbank text-white">
                      {player.points} pts
                    </div>
                    <div className="text-xs text-[#00F0B5]">
                      +2.8% from previous
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}