import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Tournament, Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Calendar, Users, Trophy, Clock, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { MoneyPoolSummary } from "@/components/money-pool-summary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TournamentDetails() {
  const { tournamentId } = useParams();
  const { user } = useAuth();

  // Fetch tournament details
  const { data: tournament, isLoading: tournamentLoading } = useQuery<Tournament & { registeredTeams: number; isUserTeamRegistered?: boolean }>({
    queryKey: ['/api/tournaments', tournamentId],
    enabled: !!tournamentId,
  });

  // Fetch user's team
  const { data: team } = useQuery<Team>({
    queryKey: ['/api/team'],
  });

  // Fetch registered teams for this tournament
  const { data: registeredTeams, isLoading: teamsLoading } = useQuery<{ teamId: string; teamName: string; registrationDate: string }[]>({
    queryKey: ['/api/tournaments', tournamentId, 'teams'],
    enabled: !!tournamentId,
  });

  if (tournamentLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Tournament Not Found</h2>
        <p className="text-muted-foreground mb-6">The tournament you are looking for does not exist or has been removed</p>
        <Button asChild>
          <Link href="/tournaments">Back to Tournaments</Link>
        </Button>
      </div>
    );
  }

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

  // Check if the user is the tournament organizer (simplified for demo)
  // In a real app, you'd check against the tournament's creator ID
  const isOrganizer = team && team.ownerId === user?.id;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="outline"
          asChild
          className="mb-4"
        >
          <Link href="/tournaments">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Tournaments
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <div className="flex items-center">
              <h2 className="text-3xl font-burbank mr-3">{tournament.name}</h2>
              <Badge variant={tournament.type === 'MAJOR' ? 'default' : 'secondary'} className="uppercase">
                {tournament.type}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{tournament.description || "Compete against the best players for glory and prizes"}</p>
          </div>

          <div className="mt-4 md:mt-0">
            {tournament.isUserTeamRegistered ? (
              <Button variant="destructive">
                Unregister Team
              </Button>
            ) : (
              <Button variant="default">
                Register Team
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="teams">Teams ({tournament.registeredTeams})</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tournament Information</CardTitle>
                  <CardDescription>Everything you need to know about this tournament</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <Calendar className="h-5 w-5 mr-3 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Date</p>
                          <p className="text-muted-foreground">{formattedDate}</p>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <Clock className="h-5 w-5 mr-3 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Time</p>
                          <p className="text-muted-foreground">{tournament.time}</p>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <Trophy className="h-5 w-5 mr-3 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Standard Prize Pool</p>
                          <p className="text-muted-foreground">{prizePoolFormatted} in-game coins</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Button asChild variant="outline" className="w-full">
                          <Link href={`/tournament/${tournamentId}/prize-pool`}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            View Real Money Prize Pool
                          </Link>
                        </Button>
                      </div>

                      <div className="flex items-center">
                        <Users className="h-5 w-5 mr-3 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Team Capacity</p>
                          <p className="text-muted-foreground">
                            {tournament.registeredTeams} / {tournament.maxTeams} teams registered
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted rounded-lg p-4">
                      <h4 className="font-medium mb-2">Tournament Description</h4>
                      <p className="text-sm text-muted-foreground">
                        {tournament.description || `
                          Compete against the best Fortnite players for glory and prizes.
                          The top teams will advance to the finals and have a chance to win
                          the grand prize!

                          Be ready to show off your building, editing, and fighting skills
                          in various game modes.
                        `}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teams" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Registered Teams</CardTitle>
                  <CardDescription>Teams that have signed up for this tournament</CardDescription>
                </CardHeader>
                <CardContent>
                  {teamsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : registeredTeams && registeredTeams.length > 0 ? (
                    <div className="space-y-4">
                      {registeredTeams.map((registeredTeam, index) => (
                        <div key={registeredTeam.teamId} className="flex justify-between items-center border-b last:border-0 pb-2">
                          <div className="flex items-center">
                            <div className="bg-background w-8 h-8 rounded-full flex items-center justify-center mr-3">
                              {index + 1}
                            </div>
                            <span className="font-medium">{registeredTeam.teamName}</span>
                          </div>
                          <Badge variant="outline">
                            {new Date(registeredTeam.registrationDate).toLocaleDateString()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No teams have registered yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rules" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tournament Rules</CardTitle>
                  <CardDescription>Official rules and guidelines</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">General Rules</h4>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        <li>All participants must follow the Fortnite Code of Conduct</li>
                        <li>Teams must check in 30 minutes before the start time</li>
                        <li>Any form of cheating will result in immediate disqualification</li>
                        <li>Tournament admins have the final say in all disputes</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Format</h4>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        <li>The tournament will consist of 6 matches</li>
                        <li>Points are awarded for eliminations (1 point each) and placements</li>
                        <li>Victory Royale: 10 points</li>
                        <li>Top 5: 7 points</li>
                        <li>Top 10: 5 points</li>
                        <li>Top 25: 3 points</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Prizes</h4>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        <li>1st Place: 60% of prize pool</li>
                        <li>2nd Place: 30% of prize pool</li>
                        <li>3rd Place: 10% of prize pool</li>
                        <li>Additional PayPal prize pool (if available) goes 100% to 1st place</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <MoneyPoolSummary
            tournamentId={tournament.id}
            tournamentName={tournament.name}
            isOrganizer={isOrganizer}
          />
        </div>
      </div>
    </div>
  );
}