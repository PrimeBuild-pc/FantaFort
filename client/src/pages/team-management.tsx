import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import CreateTeamForm from "@/components/create-team-form";
import { User, Team, TeamMember } from "@/lib/types";

export default function TeamManagement() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Fetch current user
  const { data: user, isLoading: isLoadingUser } = useQuery<User | null>({
    queryKey: ['/api/user/current'],
  });
  
  // Fetch team details if user has a team
  const { data: team, isLoading: isLoadingTeam } = useQuery<Team>({
    queryKey: ['/api/team'],
    enabled: !!user && !!user.teamId,
  });
  
  // Fetch team members if user has a team
  const { data: members, isLoading: isLoadingMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: !!team,
  });
  
  const handleCreateTeam = () => {
    setShowCreateForm(true);
  };
  
  const handleTeamCreated = () => {
    setShowCreateForm(false);
    toast({
      title: "Team Created",
      description: "Your team has been created successfully!",
      variant: "default"
    });
  };
  
  // Loading state
  if (isLoadingUser || isLoadingTeam || isLoadingMembers) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING TEAM MANAGEMENT...</div>
        <div className="text-gray-400">Please wait while we fetch your data</div>
      </div>
    );
  }
  
  // If user doesn't have a team, show create team form
  if (!user?.teamId && !showCreateForm) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-burbank text-white mb-2">YOU DON'T HAVE A TEAM YET</h2>
          <p className="text-gray-400 mb-6">Create your fantasy Fortnite team to start competing!</p>
          <Button variant="fortnite" className="btn-glow" onClick={handleCreateTeam}>
            <i className="fas fa-users mr-2"></i> Create Team
          </Button>
        </div>
      </div>
    );
  }
  
  // Show create team form
  if (showCreateForm) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <CreateTeamForm onSuccess={handleTeamCreated} />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      {/* Team Management Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h2 className="text-3xl font-burbank text-white mb-1">TEAM MANAGEMENT</h2>
            <p className="text-gray-400">Manage your fantasy Fortnite team</p>
          </div>
        </div>
      </div>
      
      {/* Team Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="fortnite-card p-6 mb-6">
            <div className="flex items-center mb-4">
              {team?.logo ? (
                <div className="w-16 h-16 rounded-full overflow-hidden mr-4">
                  <img src={team.logo} alt={team.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mr-4">
                  <i className="fas fa-users text-2xl text-gray-400"></i>
                </div>
              )}
              <div>
                <h3 className="text-2xl font-burbank text-white">{team?.name}</h3>
                <p className="text-gray-400">Rank #{team?.rank} • {team?.points} Points</p>
              </div>
            </div>
            
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h4 className="text-white font-burbank mb-2">TEAM DESCRIPTION</h4>
              <p className="text-gray-400">{team?.description || "No description provided."}</p>
            </div>
            
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h4 className="text-white font-burbank mb-2">TEAM MEMBERS</h4>
              {members && members.length > 0 ? (
                <div className="space-y-2">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center p-2 bg-gray-800 bg-opacity-50 rounded">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                        <i className="fas fa-user text-gray-400"></i>
                      </div>
                      <div>
                        <p className="text-white">{member.username}</p>
                        <p className="text-xs text-gray-400">{member.role || "Member"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No team members yet.</p>
              )}
            </div>
            
            <div className="mt-6 flex space-x-3">
              <Button variant="fortnite" className="btn-glow">
                <i className="fas fa-edit mr-2"></i> Edit Team
              </Button>
              <Button variant="outline" className="border-gray-600 text-gray-400 hover:text-white">
                <i className="fas fa-user-plus mr-2"></i> Invite Member
              </Button>
            </div>
          </Card>
        </div>
        
        <div>
          <Card className="fortnite-card p-6 mb-6">
            <h3 className="text-xl font-burbank text-white mb-4">TEAM STATS</h3>
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 mb-1">Current Rank</p>
                <p className="text-2xl font-burbank text-white">#{team?.rank || 0}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Total Points</p>
                <p className="text-2xl font-burbank text-white">{team?.points || 0}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Team Created</p>
                <p className="text-white">{team?.createdAt || "Unknown"}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Team Members</p>
                <p className="text-white">{members?.length || 1}</p>
              </div>
            </div>
          </Card>
          
          <Card className="fortnite-card p-6">
            <h3 className="text-xl font-burbank text-white mb-4">QUICK ACTIONS</h3>
            <div className="space-y-3">
              <Button variant="fortnite" className="w-full justify-start">
                <i className="fas fa-trophy mr-2"></i> View Tournaments
              </Button>
              <Button variant="fortnite" className="w-full justify-start">
                <i className="fas fa-chart-line mr-2"></i> View Stats
              </Button>
              <Button variant="fortnite" className="w-full justify-start" onClick={() => window.location.href = '/workshop'}>
                <i className="fas fa-user-plus mr-2"></i> Add Players
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
