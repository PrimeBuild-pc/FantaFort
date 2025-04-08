import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tournament, Team } from "@/lib/types";
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Link } from "wouter";

interface TournamentRegistrationProps {
  tournament: Tournament & { isUserTeamRegistered?: boolean };
}

export default function TournamentRegistration({ tournament }: TournamentRegistrationProps) {
  const { toast } = useToast();
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);
  
  // Fetch user's team
  const { data: team } = useQuery<Team>({
    queryKey: ['/api/team'],
  });
  
  // Tournament registration mutation
  const registerMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register for tournament');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Registration Successful",
        description: `Your team has been registered for ${tournament.name}!`,
      });
      setIsRegistrationDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    }
  });
  
  const handleRegisterClick = () => {
    if (!team) {
      toast({
        title: "No Team",
        description: "You need to create a team first before registering for tournaments.",
        variant: "destructive",
      });
      return;
    }
    setIsRegistrationDialogOpen(true);
  };
  
  const confirmRegistration = () => {
    registerMutation.mutate(tournament.id);
  };
  
  // Tournament unregistration mutation
  const unregisterMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const response = await fetch(`/api/tournaments/${tournamentId}/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unregister from tournament');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Unregistered Successfully",
        description: `Your team has been unregistered from ${tournament.name}.`,
      });
      setIsRegistrationDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
    },
    onError: (error) => {
      toast({
        title: "Unregistration Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    }
  });

  const handleUnregisterClick = () => {
    if (!team) {
      toast({
        title: "No Team",
        description: "You need to have a team to unregister from tournaments.",
        variant: "destructive",
      });
      return;
    }
    setIsRegistrationDialogOpen(true);
  };

  const confirmUnregistration = () => {
    unregisterMutation.mutate(tournament.id);
  };
  
  const getRegistrationStatus = () => {
    // If already registered, show unregister button
    if (tournament.isUserTeamRegistered) {
      return {
        text: "UNREGISTER",
        variant: "destructive" as const,
        disabled: false,
        action: handleUnregisterClick,
        confirmAction: confirmUnregistration,
        isPending: unregisterMutation.isPending,
        dialogTitle: "TOURNAMENT UNREGISTRATION",
        dialogDescription: "Are you sure you want to unregister your team from this tournament?",
        dialogButtonText: "Confirm Unregistration"
      };
    }
    
    // If tournament is full, disable registration
    if (tournament.registeredTeams >= tournament.maxTeams) {
      return {
        text: "FULL",
        variant: "destructive" as const,
        disabled: true,
        action: handleRegisterClick,
        confirmAction: confirmRegistration,
        isPending: registerMutation.isPending,
        dialogTitle: "TOURNAMENT REGISTRATION",
        dialogDescription: "Are you sure you want to register your team for this tournament?",
        dialogButtonText: "Confirm Registration"
      };
    }
    
    // Default register button
    return {
      text: "REGISTER",
      variant: "fortnite" as const,
      disabled: false,
      action: handleRegisterClick,
      confirmAction: confirmRegistration,
      isPending: registerMutation.isPending,
      dialogTitle: "TOURNAMENT REGISTRATION",
      dialogDescription: "Are you sure you want to register your team for this tournament?",
      dialogButtonText: "Confirm Registration"
    };
  };
  
  const registrationStatus = getRegistrationStatus();
  const formattedDate = new Date(tournament.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  
  const prizePoolFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(tournament.prizePool);
  
  return (
    <>
      <Card className="overflow-hidden bg-[#181818] border-[#333] hover:shadow-[0_0_10px_rgba(0,240,181,0.3)] transition-shadow duration-300">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-white font-burbank text-2xl mb-1">
                <Link to={`/tournament/${tournament.id}`} className="hover:text-[#00F0B5] transition-colors cursor-pointer">
                  {tournament.name}
                </Link>
              </CardTitle>
              <CardDescription className="text-gray-400">
                {formattedDate} • {tournament.time}
              </CardDescription>
            </div>
            <Badge variant={tournament.type === 'MAJOR' ? 'default' : 'secondary'} className="uppercase">
              {tournament.type}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div>
              <p className="text-xs text-gray-400">PRIZE POOL</p>
              <p className="text-white text-lg font-burbank">{prizePoolFormatted}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">REGISTERED</p>
              <p className="text-white text-lg font-burbank">{tournament.registeredTeams}/{tournament.maxTeams}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">FORMAT</p>
              <p className="text-white text-lg font-burbank">SOLOS</p>
            </div>
          </div>
          <div className="bg-[#222] rounded-md p-3">
            <p className="text-xs text-gray-300 leading-relaxed">
              Compete against the best Fortnite players for glory and prizes. The top teams will advance to the finals and have a chance to win the grand prize!
            </p>
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Button 
            variant={registrationStatus.variant} 
            className="w-full" 
            onClick={registrationStatus.action}
            disabled={registrationStatus.disabled || registrationStatus.isPending}
          >
            {registrationStatus.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Processing...
              </>
            ) : registrationStatus.text}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Registration/Unregistration Confirmation Dialog */}
      <Dialog open={isRegistrationDialogOpen} onOpenChange={setIsRegistrationDialogOpen}>
        <DialogContent className="bg-[#1E1E1E] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-burbank text-[#00F0B5]">{registrationStatus.dialogTitle}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {registrationStatus.dialogDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-[#2A2A2A] p-4 rounded-lg">
              <h4 className="text-lg font-burbank text-white">{tournament.name}</h4>
              <p className="text-sm text-gray-400 mt-1">{formattedDate} • {tournament.time}</p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs text-gray-400">PRIZE POOL</p>
                  <p className="text-[#00F0B5] text-lg font-burbank">{prizePoolFormatted}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">FORMAT</p>
                  <p className="text-white text-lg font-burbank">SOLOS</p>
                </div>
              </div>
            </div>
            
            {team && (
              <div className="bg-[#2A2A2A] p-4 rounded-lg mt-4">
                <h4 className="text-lg font-burbank text-white">YOUR TEAM</h4>
                <p className="text-sm text-gray-400 mt-1">{team.name}</p>
                <div className="mt-2">
                  <p className="text-xs text-gray-400">CURRENT RANK</p>
                  <p className="text-white text-lg font-burbank">#{team.rank}</p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsRegistrationDialogOpen(false)}
              className="border-[#333] text-gray-300 hover:bg-[#333] hover:text-white"
            >
              Cancel
            </Button>
            <Button 
              variant={tournament.isUserTeamRegistered ? "destructive" : "fortnite"}
              onClick={registrationStatus.confirmAction}
              disabled={registrationStatus.isPending}
              className={tournament.isUserTeamRegistered ? "" : "btn-glow"}
            >
              {registrationStatus.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Processing...
                </>
              ) : (
                registrationStatus.dialogButtonText
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}