import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import PayPalPaymentButton from '@/components/paypal-payment-button';

interface PrizePoolProps {
  params: {
    tournamentId: string;
  };
}

export default function PrizePool({ params }: PrizePoolProps) {
  const { tournamentId } = params;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [amount, setAmount] = useState(10);
  const [showPayPal, setShowPayPal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Fetch tournament details
  const { data: tournament, isLoading: isLoadingTournament } = useQuery({
    queryKey: [`/api/tournaments/${tournamentId}`],
    enabled: !!tournamentId,
  });

  // Fetch money pool details
  const { data: moneyPool, isLoading: isLoadingMoneyPool } = useQuery({
    queryKey: [`/api/paypal/money-pool/${tournamentId}`],
    enabled: !!tournamentId,
  });

  // Fetch contributions
  const { data: contributions, isLoading: isLoadingContributions } = useQuery({
    queryKey: [`/api/paypal/money-pool/${tournamentId}/contributions`],
    enabled: !!tournamentId && !!moneyPool,
  });

  // Handle amount change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setAmount(value);
    }
  };

  // Handle payment success
  const handlePaymentSuccess = (details: any) => {
    setPaymentSuccess(true);
    toast({
      title: 'Payment Successful',
      description: 'Your contribution to the prize pool has been received!',
      variant: 'default'
    });
  };

  // Handle payment error
  const handlePaymentError = (error: any) => {
    toast({
      title: 'Payment Error',
      description: 'There was an error processing your payment. Please try again.',
      variant: 'destructive'
    });
  };

  // Handle payment cancel
  const handlePaymentCancel = () => {
    toast({
      title: 'Payment Cancelled',
      description: 'You cancelled the payment process.',
      variant: 'default'
    });
  };

  // Loading state
  if (isLoadingTournament || isLoadingMoneyPool) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4 loading-pulse">LOADING PRIZE POOL...</div>
        <div className="text-gray-400">Please wait while we fetch the tournament data</div>
      </div>
    );
  }

  // If tournament not found
  if (!tournament) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-xl font-burbank text-white mb-4">TOURNAMENT NOT FOUND</div>
        <div className="text-gray-400 mb-6">The tournament you're looking for doesn't exist</div>
        <Button variant="fortnite" onClick={() => setLocation('/tournaments')}>
          Back to Tournaments
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Prize Pool Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h2 className="text-3xl font-burbank text-white mb-1">{tournament.name} PRIZE POOL</h2>
            <p className="text-gray-400">Contribute to the prize pool and compete for real rewards</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Button variant="outline" onClick={() => setLocation(`/tournament/${tournamentId}`)}>
              <i className="fas fa-arrow-left mr-2"></i> Back to Tournament
            </Button>
          </div>
        </div>
      </div>

      {/* Prize Pool Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="fortnite-card p-6 mb-6">
            <h3 className="text-xl font-burbank text-white mb-4">PRIZE POOL DETAILS</h3>
            
            <div className="flex items-center justify-between mb-6 p-4 bg-[#1E1E1E] rounded-lg">
              <div>
                <p className="text-gray-400 text-sm">Current Prize Pool</p>
                <p className="text-3xl font-burbank text-[#00F0B5]">
                  ${moneyPool?.total_amount || 0} <span className="text-gray-400 text-sm">{moneyPool?.currency || 'USD'}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Contributors</p>
                <p className="text-xl font-burbank text-white">{contributions?.length || 0}</p>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-white font-burbank mb-2">ABOUT THIS PRIZE POOL</h4>
              <p className="text-gray-400 mb-4">
                This is an optional real-money prize pool for the {tournament.name} tournament. 
                Players can contribute any amount to increase the total prize, which will be awarded to the winner.
              </p>
              <p className="text-gray-400">
                All payments are processed securely through PayPal. The prize will be distributed after the tournament ends.
              </p>
            </div>
            
            {paymentSuccess ? (
              <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="bg-green-700 bg-opacity-30 rounded-full p-2 mr-3">
                    <i className="fas fa-check text-green-500"></i>
                  </div>
                  <div>
                    <h4 className="text-white font-burbank">PAYMENT SUCCESSFUL</h4>
                    <p className="text-gray-400">Thank you for your contribution to the prize pool!</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <h4 className="text-white font-burbank mb-2">CONTRIBUTE TO PRIZE POOL</h4>
                
                {showPayPal ? (
                  <div className="bg-[#1E1E1E] rounded-lg p-4">
                    <PayPalPaymentButton
                      amount={amount}
                      moneyPoolId={moneyPool?.id || tournamentId}
                      currency={moneyPool?.currency || 'USD'}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onCancel={handlePaymentCancel}
                    />
                    <Button 
                      variant="outline" 
                      className="w-full mt-4"
                      onClick={() => setShowPayPal(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="bg-[#1E1E1E] rounded-lg p-4">
                    <div className="mb-4">
                      <label htmlFor="amount" className="block text-white mb-1">Contribution Amount ($)</label>
                      <Input
                        id="amount"
                        type="number"
                        min="1"
                        value={amount}
                        onChange={handleAmountChange}
                        className="fortnite-input"
                      />
                    </div>
                    <Button 
                      variant="fortnite" 
                      className="w-full btn-glow"
                      onClick={() => setShowPayPal(true)}
                    >
                      <i className="fas fa-dollar-sign mr-2"></i> Contribute ${amount}
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <div>
              <h4 className="text-white font-burbank mb-2">PRIZE DISTRIBUTION</h4>
              <div className="bg-[#1E1E1E] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-white">1st Place</p>
                  <p className="text-[#00F0B5] font-burbank">100%</p>
                </div>
                <p className="text-gray-400 text-sm">
                  The entire prize pool will be awarded to the tournament winner.
                </p>
              </div>
            </div>
          </Card>
        </div>
        
        <div>
          <Card className="fortnite-card p-6 mb-6">
            <h3 className="text-xl font-burbank text-white mb-4">TOURNAMENT INFO</h3>
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 mb-1">Date & Time</p>
                <p className="text-white">{tournament.date} at {tournament.time}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Format</p>
                <p className="text-white">{tournament.type}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Registered Teams</p>
                <p className="text-white">{tournament.registeredTeams} / {tournament.maxTeams}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Status</p>
                <div className="flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    tournament.status === 'UPCOMING' ? 'bg-yellow-500' : 
                    tournament.status === 'ACTIVE' ? 'bg-green-500' : 
                    tournament.status === 'COMPLETED' ? 'bg-blue-500' : 'bg-gray-500'
                  }`}></span>
                  <span className="text-white">{tournament.status}</span>
                </div>
              </div>
            </div>
          </Card>
          
          <Card className="fortnite-card p-6">
            <h3 className="text-xl font-burbank text-white mb-4">RECENT CONTRIBUTIONS</h3>
            {isLoadingContributions ? (
              <p className="text-gray-400 text-center py-4">Loading contributions...</p>
            ) : contributions && contributions.length > 0 ? (
              <div className="space-y-3">
                {contributions.slice(0, 5).map((contribution: any) => (
                  <div key={contribution.id} className="flex justify-between items-center p-2 bg-[#1E1E1E] rounded">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-2">
                        <i className="fas fa-user text-gray-400"></i>
                      </div>
                      <div>
                        <p className="text-white">{contribution.user?.username || 'Anonymous'}</p>
                        <p className="text-xs text-gray-400">{new Date(contribution.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className="text-[#00F0B5] font-burbank">${contribution.amount}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">No contributions yet. Be the first!</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
