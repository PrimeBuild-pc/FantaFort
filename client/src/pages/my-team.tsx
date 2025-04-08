import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Team, TeamMember, FortnitePlayer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import PlayerCard from "@/components/player-card";
import EmptyPlayerSlot from "@/components/empty-player-slot";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { queryClient } from "@/lib/queryClient";

export default function MyTeam() {
  const { toast } = useToast();
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  
  // Fetch team details
  const { data: team, isLoading: isLoadingTeam } = useQuery<Team>({
    queryKey: ['/api/team'],
  });
  
  // Fetch team members
  const { data: members, isLoading: isLoadingMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: !!team,
  });
  
  // Fetch team roster
  const { data: players, isLoading: isLoadingPlayers } = useQuery<FortnitePlayer[]>({
    queryKey: ['/api/players'],
  });
  
  // Team creation mutation
  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create team');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team Created",
        description: "Your team has been successfully created!",
      });
      setIsCreateTeamDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/team'] });
    },
    onError: (error) => {
      toast({
        title: "Team Creation Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    }
  });
  
  const handleInviteMember = () => {
    toast({
      title: "Coming Soon",
      description: "Team invitations will be available in the next update.",
    });
  };

  const handleCreateTeam = () => {
    if (!teamName.trim()) {
      toast({
        title: "Team Name Required",
        description: "Please enter a team name",
        variant: "destructive",
      });
      return;
    }
    
    createTeamMutation.mutate({ name: teamName.trim() });
  };
  
  // Loading state
  if (isLoadingTeam || isLoadingMembers || isLoadingPlayers) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING TEAM DATA...</div>
        <div className="text-gray-400">Please wait while we fetch your team information</div>
      </div>
    );
  }
  
  // If no team exists yet
  if (!team) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">CREATE YOUR TEAM</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex justify-center mb-6">
              <div className="h-24 w-24 bg-[#2D0E75] rounded-full flex items-center justify-center">
                <i className="fas fa-users text-[#00F0B5] text-4xl"></i>
              </div>
            </div>
            <p className="text-gray-400 mb-6">You haven't created a team yet. Create your own team to start managing players and competing in tournaments.</p>
            <Button 
              variant="fortnite" 
              className="w-full max-w-xs mx-auto"
              onClick={() => setIsCreateTeamDialogOpen(true)}
            >
              Create New Team
            </Button>
            
            <Dialog open={isCreateTeamDialogOpen} onOpenChange={setIsCreateTeamDialogOpen}>
              <DialogContent className="bg-[#1E1E1E] border-[#333] text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-burbank text-[#00F0B5]">CREATE YOUR TEAM</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Enter a name for your Fortnite Fantasy team
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                  <Label htmlFor="team-name" className="text-gray-300">Team Name</Label>
                  <Input 
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter an epic team name" 
                    className="bg-[#121212] border-[#333] text-white mt-2"
                  />
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateTeamDialogOpen(false)}
                    className="border-[#333] text-gray-300 hover:bg-[#333] hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="fortnite"
                    onClick={handleCreateTeam}
                    disabled={createTeamMutation.isPending}
                    className="btn-glow"
                  >
                    {createTeamMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Creating...
                      </>
                    ) : (
                      "Create Team"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rosterPlayers = players || [];
  const totalSlots = 8;
  const filledSlots = rosterPlayers.length;
  const emptySlots = totalSlots - filledSlots;
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h2 className="text-3xl font-burbank text-white mb-1">{team.name.toUpperCase()}</h2>
          <p className="text-gray-400">Rank #{team.rank} • {team.points.toLocaleString()} Points</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button variant="fortnite" className="btn-glow" onClick={handleInviteMember}>
            <i className="fas fa-user-plus mr-2"></i> Invite Member
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Team Members Section */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>TEAM MEMBERS</CardTitle>
            </CardHeader>
            <CardContent>
              {members && members.length > 0 ? (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center p-3 bg-[#1E1E1E] rounded-lg">
                      <div className="h-10 w-10 rounded-full overflow-hidden mr-3">
                        <img 
                          src={member.avatar || "https://via.placeholder.com/40"} 
                          alt={member.username} 
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-white">{member.username}</p>
                        <p className="text-xs text-gray-400">Member</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-400">No team members yet</p>
                  <p className="text-sm text-gray-500 mt-1">Invite friends to join your team</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>TEAM SETTINGS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Team Privacy</span>
                  <span className="text-[#00F0B5]">Public</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Allow Trade Requests</span>
                  <span className="text-[#00F0B5]">Enabled</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Member Permissions</span>
                  <span className="text-[#00F0B5]">Limited</span>
                </div>
                <Button variant="dark" className="w-full mt-4">
                  Edit Team Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Team Roster Section */}
        <div className="lg:col-span-8">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>TEAM ROSTER</CardTitle>
                <span className="text-sm text-gray-400">
                  <span className="text-[#00F0B5] font-medium">{filledSlots}/{totalSlots}</span> Players
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rosterPlayers.map(player => (
                  <PlayerCard key={player.id} player={player} />
                ))}
                
                {/* Empty slots */}
                {Array.from({ length: emptySlots }).map((_, index) => (
                  <EmptyPlayerSlot 
                    key={`empty-${index}`} 
                    remainingSlots={emptySlots}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
