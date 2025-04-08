import { useState, useEffect } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, DollarSign, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';

interface PrizePoolPayPalProps {
  teamId: string;
  teamName: string;
  onPrizePoolCreated?: (amount: number) => void;
}

export function PrizePoolPayPal({ teamId, teamName, onPrizePoolCreated }: PrizePoolPayPalProps) {
  const [amount, setAmount] = useState<string>('10.00');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPrizePoolEnabled, setIsPrizePoolEnabled] = useState<boolean>(false);
  const [currentPrizePool, setCurrentPrizePool] = useState<number>(0);
  const [isPayPalReady, setIsPayPalReady] = useState<boolean>(false);

  // PayPal client ID from environment variables
  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'sb';

  // Fetch current prize pool amount
  useEffect(() => {
    const fetchPrizePool = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/team/${teamId}/prize-pool`);
        
        if (response.ok) {
          const data = await response.json();
          setCurrentPrizePool(data.amount || 0);
          setIsPrizePoolEnabled(data.enabled || false);
        }
      } catch (error) {
        console.error('Error fetching prize pool:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (teamId) {
      fetchPrizePool();
    }
  }, [teamId]);

  // Toggle prize pool enabled/disabled
  const handleTogglePrizePool = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/team/${teamId}/prize-pool/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: !isPrizePoolEnabled,
        }),
      });

      if (response.ok) {
        setIsPrizePoolEnabled(!isPrizePoolEnabled);
        toast.success(
          !isPrizePoolEnabled
            ? 'Prize pool has been enabled'
            : 'Prize pool has been disabled'
        );
      } else {
        throw new Error('Failed to toggle prize pool');
      }
    } catch (error) {
      console.error('Error toggling prize pool:', error);
      toast.error('Failed to toggle prize pool');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle PayPal transaction success
  const handlePayPalApprove = async (data: any, actions: any) => {
    try {
      setIsLoading(true);
      
      // Capture the funds from the transaction
      const details = await actions.order.capture();
      
      // Save the transaction to our backend
      const response = await fetch(`/api/team/${teamId}/prize-pool/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: details.id,
          amount: parseFloat(amount),
          paypalDetails: details,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save transaction');
      }

      const responseData = await response.json();
      
      // Update the current prize pool amount
      setCurrentPrizePool(responseData.newTotal || (currentPrizePool + parseFloat(amount)));
      
      // Call the callback if provided
      if (onPrizePoolCreated) {
        onPrizePoolCreated(parseFloat(amount));
      }
      
      toast.success(`Successfully added $${amount} to the prize pool!`);
      
      return true;
    } catch (error) {
      console.error('Error processing PayPal transaction:', error);
      toast.error('Failed to process payment');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Create PayPal order
  const createOrder = (data: any, actions: any) => {
    return actions.order.create({
      purchase_units: [
        {
          description: `Prize Pool Contribution for ${teamName}`,
          amount: {
            currency_code: 'USD',
            value: amount,
          },
        },
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    });
  };

  return (
    <PayPalScriptProvider
      options={{
        'client-id': paypalClientId,
        currency: 'USD',
        intent: 'capture',
      }}
      onReady={() => setIsPayPalReady(true)}
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="mr-2 h-5 w-5 text-yellow-400" />
            Team Prize Pool
          </CardTitle>
          <CardDescription>
            Create a prize pool for your team to reward top performers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="prize-pool-toggle"
                checked={isPrizePoolEnabled}
                onCheckedChange={handleTogglePrizePool}
                disabled={isLoading}
              />
              <Label htmlFor="prize-pool-toggle">
                {isPrizePoolEnabled ? 'Prize Pool Enabled' : 'Prize Pool Disabled'}
              </Label>
            </div>
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="font-bold text-lg">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `$${currentPrizePool.toFixed(2)}`
                )}
              </span>
            </div>
          </div>

          {isPrizePoolEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="amount">Contribution Amount (USD)</Label>
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    min="5.00"
                    step="5.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1"
                    placeholder="10.00"
                  />
                </div>
              </div>

              <div className="rounded-md border p-4 bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div>
                    <h4 className="font-semibold">Team Prize Distribution</h4>
                    <p className="text-sm text-muted-foreground">
                      Prizes will be distributed based on team performance:
                    </p>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-sm pl-7 list-disc">
                  <li>1st Place: 50% of prize pool</li>
                  <li>2nd Place: 30% of prize pool</li>
                  <li>3rd Place: 20% of prize pool</li>
                </ul>
              </div>

              {isPayPalReady ? (
                <PayPalButtons
                  style={{
                    layout: 'vertical',
                    color: 'blue',
                    shape: 'rect',
                    label: 'contribute',
                  }}
                  createOrder={createOrder}
                  onApprove={handlePayPalApprove}
                  disabled={isLoading || parseFloat(amount) < 5}
                />
              ) : (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 items-start">
          <p className="text-xs text-muted-foreground">
            All contributions are final and non-refundable. Prize pools are distributed at the end of the tournament.
          </p>
        </CardFooter>
      </Card>
    </PayPalScriptProvider>
  );
}
