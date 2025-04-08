import { useState, useEffect, useRef } from 'react';
import { usePaypal } from '@/hooks/use-paypal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    paypal?: any;
  }
}

type PaypalButtonProps = {
  poolId: string;
  tournamentName: string;
  onSuccess?: () => void;
};

export function PaypalButton({ poolId, tournamentName, onSuccess }: PaypalButtonProps) {
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState('5.00');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
  const {
    isConfigured,
    paypalReady,
    createOrderMutation,
    capturePaymentMutation
  } = usePaypal();
  
  useEffect(() => {
    // Clean up the previous PayPal button if it exists
    if (paypalButtonRef.current) {
      paypalButtonRef.current.innerHTML = '';
    }
    
    if (paypalReady && window.paypal && poolId) {
      try {
        window.paypal
          .Buttons({
            style: {
              color: 'blue',
              shape: 'pill',
            },
            createOrder: async () => {
              setIsProcessing(true);
              try {
                const response = await createOrderMutation.mutateAsync({
                  poolId,
                  amount,
                });
                return response.orderId;
              } catch (error) {
                console.error('Error creating order:', error);
                setIsProcessing(false);
                throw error;
              }
            },
            onApprove: async (data: any) => {
              try {
                // Get the contribution ID from the order creation response
                const { orderId } = data;
                const contributionId = createOrderMutation.data?.contribution.id;
                
                if (!contributionId) {
                  throw new Error('Contribution ID not found');
                }
                
                await capturePaymentMutation.mutateAsync({
                  orderId,
                  contributionId,
                });
                
                if (onSuccess) {
                  onSuccess();
                }
              } catch (error) {
                console.error('Error capturing payment:', error);
                toast({
                  title: 'Payment failed',
                  description: 'There was an error processing your payment',
                  variant: 'destructive',
                });
              } finally {
                setIsProcessing(false);
              }
            },
            onCancel: () => {
              setIsProcessing(false);
              toast({
                title: 'Payment cancelled',
                description: 'You cancelled the payment process',
                variant: 'default',
              });
            },
            onError: (err: any) => {
              setIsProcessing(false);
              console.error('PayPal error:', err);
              toast({
                title: 'PayPal error',
                description: 'There was an error with PayPal. Please try again later.',
                variant: 'destructive',
              });
            },
          })
          .render(paypalButtonRef.current);
      } catch (error) {
        console.error('Error rendering PayPal button:', error);
      }
    }
  }, [
    paypalReady,
    poolId,
    amount,
    createOrderMutation,
    capturePaymentMutation,
    onSuccess,
    toast,
  ]);
  
  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prize Pool Contribution</CardTitle>
          <CardDescription>PayPal integration is not configured</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            PayPal is not configured for this application. Please contact the administrator.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribute to Prize Pool</CardTitle>
        <CardDescription>
          Support the {tournamentName} tournament by adding to the prize pool
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Contribution Amount (USD)</Label>
          <Input
            id="amount"
            type="number"
            min="1.00"
            step="1.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isProcessing}
          />
        </div>
        
        {isProcessing && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Processing payment...</span>
          </div>
        )}
        
        <div ref={paypalButtonRef} />
        
        {!paypalReady && (
          <div className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading PayPal...</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between text-xs text-muted-foreground">
        <p>Secure payment via PayPal</p>
        <p>100% goes to the winner</p>
      </CardFooter>
    </Card>
  );
}