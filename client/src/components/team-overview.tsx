import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Team, TeamMember } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface TeamOverviewProps {
  team: Team;
  members: TeamMember[];
}

export default function TeamOverview({ team, members }: TeamOverviewProps) {
  const { toast } = useToast();
  
  const handleInvitePlayers = () => {
    toast({
      title: "Coming Soon",
      description: "Team invitations will be available in the next update.",
    });
  };

  return (
    <Card className="p-4 mb-6">
      <CardHeader className="p-0 mb-4">
        <CardTitle>TEAM OVERVIEW</CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="flex items-center mb-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#2D0E75] to-[#1890FF] flex items-center justify-center">
            <i className="fas fa-bolt text-2xl text-white"></i>
          </div>
          <div className="ml-4">
            <h4 className="font-burbank text-lg text-white">{team.name}</h4>
            <p className="text-sm text-gray-400">Created {team.createdAt}</p>
          </div>
        </div>
        
        <div className="border-t border-b border-[#333333] py-3 my-2">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Members</span>
            <span className="text-white font-medium">{members.length}/6</span>
          </div>
          <div className="flex -space-x-2">
            {members.map((member) => (
              <img 
                key={member.id}
                src={member.avatar || "https://via.placeholder.com/40"} 
                alt={`${member.username}`} 
                className="w-8 h-8 rounded-full border-2 border-[#1E1E1E]"
              />
            ))}
            {members.length < 6 && (
              <div className="w-8 h-8 rounded-full bg-[#121212] border-2 border-[#1E1E1E] flex items-center justify-center text-gray-500 text-xs">
                +{6 - members.length}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4">
          <Button 
            variant="fortnite" 
            className="w-full"
            onClick={handleInvitePlayers}
          >
            <i className="fas fa-user-plus mr-2"></i> Invite Players
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
