import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

export default function CreateTeamForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [teamLogo, setTeamLogo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['/api/user/current'],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teamName.trim()) {
      toast({
        title: "Team Name Required",
        description: "Please enter a name for your team.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/team/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: uuidv4(),
          name: teamName,
          description: teamDescription,
          logo: teamLogo,
          ownerId: user?.id,
          isPublic: true
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create team");
      }
      
      const data = await response.json();
      
      toast({
        title: "Team Created",
        description: `Your team "${teamName}" has been created successfully!`,
        variant: "default"
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/user/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team'] });
      
      // Reset form
      setTeamName("");
      setTeamDescription("");
      setTeamLogo("");
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create team",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="fortnite-card p-6">
      <h2 className="text-2xl font-burbank text-white mb-4">CREATE YOUR TEAM</h2>
      <p className="text-gray-400 mb-6">Create your fantasy Fortnite team to start competing!</p>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="teamName" className="block text-white mb-1">Team Name</label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
              className="fortnite-input"
              required
            />
          </div>
          
          <div>
            <label htmlFor="teamLogo" className="block text-white mb-1">Team Logo URL (Optional)</label>
            <Input
              id="teamLogo"
              value={teamLogo}
              onChange={(e) => setTeamLogo(e.target.value)}
              placeholder="Enter logo URL"
              className="fortnite-input"
            />
          </div>
          
          <div>
            <label htmlFor="teamDescription" className="block text-white mb-1">Team Description (Optional)</label>
            <Textarea
              id="teamDescription"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder="Describe your team"
              className="fortnite-input min-h-[100px]"
            />
          </div>
          
          <Button 
            type="submit" 
            variant="fortnite" 
            className="w-full btn-glow"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i> Creating...
              </span>
            ) : (
              <span className="flex items-center">
                <i className="fas fa-users mr-2"></i> Create Team
              </span>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
