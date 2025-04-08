import { useState } from 'react';
import { usePaypal } from '@/hooks/use-paypal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PaypalButton } from './paypal-button';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Trophy, Users, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from 'date-fns';

type MoneyPoolSummaryProps = {
  tournamentId: string;
  tournamentName: string;
  isOrganizer?: boolean;
};

export function MoneyPoolSummary({ 
  tournamentId, 
  tournamentName,
  isOrganizer = false
}: MoneyPoolSummaryProps) {
  const [showContributeForm, setShowContributeForm] = useState(false);
  const { user } = useAuth();
  const { 
    getMoneyPoolByTournament,
    createMoneyPoolMutation,
    distributePrizeMutation,
  } = usePaypal();
  
  const {
    data: poolData,
    isLoading: poolLoading,
    isError: poolError,
    refetch: refetchPool,
  } = getMoneyPoolByTournament(tournamentId);
  
  const handleCreatePool = async () => {
    await createMoneyPoolMutation.mutateAsync({
      tournamentId,
      currency: 'USD'
    });
    
    refetchPool();
  };
  
  const handleDistributePrize = async (winnerId: number) => {
    if (!poolData || !poolData.pool) return;
    
    await distributePrizeMutation.mutateAsync({
      poolId: poolData.pool.id,
      winnerId,
    });
    
    refetchPool();
  };
  
  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount));
  };
  
  if (poolLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Loading prize pool information...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (poolError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Error loading prize pool information.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchPool()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // If no pool exists yet and user is an organizer, show create pool button
  if (!poolData || !poolData.pool) {
    if (isOrganizer) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Prize Pool</CardTitle>
            <CardDescription>
              No prize pool has been created for this tournament yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              As the tournament organizer, you can create a prize pool where 
              participants can contribute. The winner will receive the entire 
              prize pool.
            </p>
            <Button 
              onClick={handleCreatePool}
              disabled={createMoneyPoolMutation.isPending}
            >
              {createMoneyPoolMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Prize Pool
            </Button>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prize Pool</CardTitle>
          <CardDescription>
            No prize pool available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This tournament doesn't have a prize pool yet.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const { pool, contributions } = poolData;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
              Prize Pool
            </CardTitle>
            <CardDescription>
              {pool.status === 'COLLECTING' 
                ? 'Contribute to increase the prize for the winner' 
                : 'Prize pool is now closed'}
            </CardDescription>
          </div>
          <Badge variant={pool.status === 'COLLECTING' ? 'default' : 'secondary'}>
            {pool.status === 'COLLECTING' ? 'Open' : 'Closed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center p-4 bg-muted rounded-md">
          <div className="flex items-center">
            <DollarSign className="h-6 w-6 mr-2 text-green-500" />
            <div>
              <p className="text-sm font-medium">Current Pool</p>
              <p className="text-2xl font-bold">{formatCurrency(pool.totalAmount)}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Contributors</p>
              <p className="text-xl font-semibold">{contributions?.length || 0}</p>
            </div>
          </div>
        </div>
        
        {/* Show contribute button if pool is still open */}
        {pool.status === 'COLLECTING' && !showContributeForm && (
          <Button 
            className="w-full" 
            onClick={() => setShowContributeForm(true)}
          >
            Contribute to Prize Pool
          </Button>
        )}
        
        {/* Show PayPal contribution form */}
        {pool.status === 'COLLECTING' && showContributeForm && (
          <div className="border rounded-md p-4">
            <PaypalButton 
              poolId={pool.id} 
              tournamentName={tournamentName}
              onSuccess={() => {
                setShowContributeForm(false);
                refetchPool();
              }}
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => setShowContributeForm(false)}
            >
              Cancel
            </Button>
          </div>
        )}
        
        {/* Show distribute button for organizers if pool is still collecting */}
        {isOrganizer && pool.status === 'COLLECTING' && (
          <Button 
            variant="secondary" 
            className="w-full"
            disabled={distributePrizeMutation.isPending}
            onClick={() => {
              if (window.confirm('Are you sure you want to close this prize pool and distribute to the winner?')) {
                // In a real app, you would select the winner based on tournament results
                // For demo purposes, we're using the current user ID
                handleDistributePrize(user?.id || 0);
              }
            }}
          >
            {distributePrizeMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Close Pool & Distribute Prize
          </Button>
        )}
        
        {/* Show contributions */}
        {contributions && contributions.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="contributions">
              <AccordionTrigger>View Contributors</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {contributions.map((contribution) => (
                    <div 
                      key={contribution.id} 
                      className="flex justify-between items-center py-2 border-b text-sm"
                    >
                      <div>
                        <p className="font-medium">User #{contribution.userId}</p>
                        <p className="text-xs text-muted-foreground">
                          {contribution.createdAt && format(new Date(contribution.createdAt), 'PPp')}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatCurrency(contribution.amount)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground border-t pt-4">
        {pool.winnerId ? (
          <p>Prize of {formatCurrency(pool.totalAmount)} was awarded to user #{pool.winnerId}</p>
        ) : (
          <p>Winner takes all - 100% of contributions go to the tournament winner</p>
        )}
      </CardFooter>
    </Card>
  );
}