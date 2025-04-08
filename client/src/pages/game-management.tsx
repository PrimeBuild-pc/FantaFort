import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { GamePhase, GameSettings } from "@/lib/types";

interface CreatePhaseFormData {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
}

interface UpdateGameSettingsFormData {
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  startingCoins: number;
  transferWindowDuration: number;
  priceUpdateFrequency: number;
  minPlayerPrice: number;
  maxPlayerPrice: number;
  draftEnabled: boolean;
  draftDuration: number;
}

function formatDateTime(dateString: string | Date): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString();
}

function calculateTimeRemaining(endTime: string | Date): string {
  const end = new Date(endTime).getTime();
  const now = new Date().getTime();
  const distance = end - now;
  
  if (distance < 0) return "Expired";
  
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${days}d ${hours}h ${minutes}m`;
}

export default function GameManagement() {
  // Phase Management
  const [newPhase, setNewPhase] = useState<CreatePhaseFormData>({
    name: "",
    description: "",
    startTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    type: "REGULAR_SEASON",
    status: "UPCOMING"
  });

  // Game Settings Management
  const [gameSettings, setGameSettings] = useState<UpdateGameSettingsFormData>({
    seasonName: "Season 1",
    seasonStartDate: new Date().toISOString().slice(0, 16),
    seasonEndDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
    startingCoins: 2500,
    transferWindowDuration: 48,
    priceUpdateFrequency: 24,
    minPlayerPrice: 100,
    maxPlayerPrice: 10000,
    draftEnabled: true,
    draftDuration: 60
  });

  // Fetch Game Phases
  const { data: phases = [], refetch: refetchPhases } = useQuery<GamePhase[]>({
    queryKey: ["/api/game-phases"],
    queryFn: ({ queryKey }) => fetch(queryKey[0] as string).then(res => res.json()),
  });

  // Fetch Active Phase
  const { data: activePhase } = useQuery<GamePhase>({
    queryKey: ["/api/game-phases/active"],
    queryFn: ({ queryKey }) => fetch(queryKey[0] as string)
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
  });

  // Fetch Game Settings
  const { data: settings, refetch: refetchSettings } = useQuery<GameSettings>({
    queryKey: ["/api/game-settings"],
    queryFn: ({ queryKey }) => fetch(queryKey[0] as string)
      .then(res => res.ok ? res.json() : null)
      .catch(() => null),
  });

  // Create Phase Mutation
  const createPhaseMutation = useMutation({
    mutationFn: async (phase: CreatePhaseFormData) => {
      const res = await apiRequest("POST", "/api/game-phases", phase);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Phase Created",
        description: "A new game phase has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/game-phases"] });
      refetchPhases();
      
      // Reset form
      setNewPhase({
        name: "",
        description: "",
        startTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
        endTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
        type: "REGULAR_SEASON",
        status: "UPCOMING"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Phase",
        description: error.message || "An error occurred while creating the phase.",
        variant: "destructive",
      });
    },
  });

  // Update Phase Status Mutation
  const updatePhaseMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PUT", `/api/game-phases/${id}`, { status });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Phase Updated",
        description: `Phase status updated to ${data.status}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/game-phases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-phases/active"] });
      refetchPhases();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Phase",
        description: error.message || "An error occurred while updating the phase.",
        variant: "destructive",
      });
    },
  });

  // Create or Update Game Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: UpdateGameSettingsFormData) => {
      // Check if settings exist and send appropriate request
      const method = settings ? "PUT" : "POST";
      const res = await apiRequest(method, "/api/game-settings", settings);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Game settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/game-settings"] });
      refetchSettings();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Settings",
        description: error.message || "An error occurred while updating game settings.",
        variant: "destructive",
      });
    },
  });

  // Set form values from settings data when available
  useEffect(() => {
    if (settings) {
      setGameSettings({
        seasonName: settings.seasonName,
        seasonStartDate: new Date(settings.seasonStartDate).toISOString().slice(0, 16),
        seasonEndDate: new Date(settings.seasonEndDate).toISOString().slice(0, 16),
        startingCoins: settings.startingCoins,
        transferWindowDuration: settings.transferWindowDuration,
        priceUpdateFrequency: settings.priceUpdateFrequency,
        minPlayerPrice: settings.minPlayerPrice,
        maxPlayerPrice: settings.maxPlayerPrice,
        draftEnabled: settings.draftEnabled,
        draftDuration: settings.draftDuration
      });
    }
  }, [settings]);

  // Handle creating a new phase
  const handleCreatePhase = (e: React.FormEvent) => {
    e.preventDefault();
    createPhaseMutation.mutate(newPhase);
  };

  // Handle updating phase status
  const handleUpdatePhaseStatus = (id: string, status: string) => {
    updatePhaseMutation.mutate({ id, status });
  };

  // Handle updating game settings
  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(gameSettings);
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Game Management</h1>
      
      <Tabs defaultValue="phases">
        <TabsList className="mb-4">
          <TabsTrigger value="phases">Game Phases</TabsTrigger>
          <TabsTrigger value="settings">Game Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="phases" className="space-y-6">
          {activePhase && (
            <Card className="bg-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Active Phase: {activePhase.name}</span>
                  <Badge>{activePhase.type}</Badge>
                </CardTitle>
                <CardDescription>
                  {activePhase.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Time</p>
                    <p>{formatDateTime(activePhase.startTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Time</p>
                    <p>{formatDateTime(activePhase.endTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time Remaining</p>
                    <p>{calculateTimeRemaining(activePhase.endTime)}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="destructive" 
                  onClick={() => handleUpdatePhaseStatus(activePhase.id, "COMPLETED")}
                >
                  End Current Phase
                </Button>
              </CardFooter>
            </Card>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create New Phase Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create New Phase</CardTitle>
                <CardDescription>Set up a new game phase for your fantasy league</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePhase} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Phase Name</Label>
                    <Input 
                      id="name" 
                      value={newPhase.name} 
                      onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                      id="description" 
                      value={newPhase.description} 
                      onChange={(e) => setNewPhase({ ...newPhase, description: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input 
                        id="startTime" 
                        type="datetime-local" 
                        value={newPhase.startTime} 
                        onChange={(e) => setNewPhase({ ...newPhase, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input 
                        id="endTime" 
                        type="datetime-local" 
                        value={newPhase.endTime} 
                        onChange={(e) => setNewPhase({ ...newPhase, endTime: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Phase Type</Label>
                      <select 
                        id="type" 
                        className="w-full p-2 rounded-md border border-input bg-background"
                        value={newPhase.type} 
                        onChange={(e) => setNewPhase({ ...newPhase, type: e.target.value })}
                        required
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="REGULAR_SEASON">Regular Season</option>
                        <option value="PLAYOFFS">Playoffs</option>
                        <option value="TRANSFER_WINDOW">Transfer Window</option>
                        <option value="OFF_SEASON">Off Season</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Initial Status</Label>
                      <select 
                        id="status" 
                        className="w-full p-2 rounded-md border border-input bg-background"
                        value={newPhase.status} 
                        onChange={(e) => setNewPhase({ ...newPhase, status: e.target.value })}
                        required
                      >
                        <option value="UPCOMING">Upcoming</option>
                        <option value="ACTIVE">Active</option>
                      </select>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={createPhaseMutation.isPending}>
                    {createPhaseMutation.isPending ? "Creating..." : "Create Phase"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {/* Upcoming Phases */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Phases</CardTitle>
                <CardDescription>Phases scheduled for the future</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {phases
                    .filter(phase => phase.status === "UPCOMING")
                    .map(phase => (
                      <Card key={phase.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold">{phase.name}</h3>
                            <p className="text-sm text-muted-foreground">{phase.description}</p>
                          </div>
                          <Badge>{phase.type}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <p className="text-muted-foreground">Starts</p>
                            <p>{formatDateTime(phase.startTime)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Ends</p>
                            <p>{formatDateTime(phase.endTime)}</p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdatePhaseStatus(phase.id, "ACTIVE")}
                          disabled={updatePhaseMutation.isPending}
                        >
                          Activate Now
                        </Button>
                      </Card>
                    ))}
                  
                  {phases.filter(phase => phase.status === "UPCOMING").length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No upcoming phases</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Completed Phases */}
          <Card>
            <CardHeader>
              <CardTitle>Completed Phases</CardTitle>
              <CardDescription>Previous game phases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {phases
                  .filter(phase => phase.status === "COMPLETED")
                  .map(phase => (
                    <Card key={phase.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{phase.name}</h3>
                        <Badge variant="outline">{phase.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{phase.description}</p>
                      <div className="text-xs text-muted-foreground">
                        <p>Started: {formatDateTime(phase.startTime)}</p>
                        <p>Ended: {formatDateTime(phase.endTime)}</p>
                      </div>
                    </Card>
                  ))}
                
                {phases.filter(phase => phase.status === "COMPLETED").length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No completed phases
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Game Settings</CardTitle>
              <CardDescription>Configure the global settings for your fantasy league</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Season Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="seasonName">Season Name</Label>
                      <Input 
                        id="seasonName" 
                        value={gameSettings.seasonName} 
                        onChange={(e) => setGameSettings({ ...gameSettings, seasonName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="seasonStartDate">Season Start Date</Label>
                      <Input 
                        id="seasonStartDate" 
                        type="datetime-local" 
                        value={gameSettings.seasonStartDate} 
                        onChange={(e) => setGameSettings({ ...gameSettings, seasonStartDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="seasonEndDate">Season End Date</Label>
                      <Input 
                        id="seasonEndDate" 
                        type="datetime-local" 
                        value={gameSettings.seasonEndDate} 
                        onChange={(e) => setGameSettings({ ...gameSettings, seasonEndDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Economy Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startingCoins">Starting Coins</Label>
                      <Input 
                        id="startingCoins" 
                        type="number" 
                        min="0"
                        value={gameSettings.startingCoins} 
                        onChange={(e) => setGameSettings({ ...gameSettings, startingCoins: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minPlayerPrice">Minimum Player Price</Label>
                      <Input 
                        id="minPlayerPrice" 
                        type="number" 
                        min="0"
                        value={gameSettings.minPlayerPrice} 
                        onChange={(e) => setGameSettings({ ...gameSettings, minPlayerPrice: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxPlayerPrice">Maximum Player Price</Label>
                      <Input 
                        id="maxPlayerPrice" 
                        type="number" 
                        min="0"
                        value={gameSettings.maxPlayerPrice} 
                        onChange={(e) => setGameSettings({ ...gameSettings, maxPlayerPrice: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Game Phase Timing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="transferWindowDuration">Transfer Window Duration (hours)</Label>
                      <Input 
                        id="transferWindowDuration" 
                        type="number" 
                        min="1"
                        value={gameSettings.transferWindowDuration} 
                        onChange={(e) => setGameSettings({ ...gameSettings, transferWindowDuration: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceUpdateFrequency">Price Update Frequency (hours)</Label>
                      <Input 
                        id="priceUpdateFrequency" 
                        type="number" 
                        min="1"
                        value={gameSettings.priceUpdateFrequency} 
                        onChange={(e) => setGameSettings({ ...gameSettings, priceUpdateFrequency: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Draft Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        id="draftEnabled"
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={gameSettings.draftEnabled}
                        onChange={(e) => setGameSettings({ ...gameSettings, draftEnabled: e.target.checked })}
                      />
                      <Label htmlFor="draftEnabled">Enable Draft Phase</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="draftDuration">Draft Duration (minutes)</Label>
                      <Input 
                        id="draftDuration" 
                        type="number" 
                        min="1"
                        value={gameSettings.draftDuration} 
                        onChange={(e) => setGameSettings({ ...gameSettings, draftDuration: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button type="submit" className="w-full" disabled={updateSettingsMutation.isPending}>
                    {updateSettingsMutation.isPending ? "Updating..." : "Update Game Settings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}