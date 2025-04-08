import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PayPalPaymentButtonProps {
  amount: number;
  moneyPoolId: string;
  currency?: string;
  onSuccess?: (details: any) => void;
  onError?: (error: any) => void;
  onCancel?: () => void;
}

export default function PayPalPaymentButton({
  amount,
  moneyPoolId,
  currency = 'USD',
  onSuccess,
  onError,
  onCancel
}: PayPalPaymentButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [orderID, setOrderID] = useState('');
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  // Load PayPal SDK
  useEffect(() => {
    const loadPayPalScript = () => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=AYMphyqMo0Qsj1AzMz2e3PMnG_yYOA6la8XvaAOxCruGhPzSn2_1_xz7RZZKGKsHCAynBbGaZwnYWCDZ&currency=${currency}`;
      script.async = true;
      script.onload = () => setPaypalLoaded(true);
      document.body.appendChild(script);
    };

    if (!document.querySelector('[src*="paypal.com/sdk/js"]')) {
      loadPayPalScript();
    } else {
      setPaypalLoaded(true);
    }

    return () => {
      // Cleanup if needed
    };
  }, [currency]);

  // Initialize PayPal buttons when SDK is loaded
  useEffect(() => {
    if (!paypalLoaded) return;

    // @ts-ignore - PayPal is loaded via script tag
    window.paypal?.Buttons({
      // Configure the PayPal buttons
      style: {
        color: 'blue',
        shape: 'rect',
        label: 'pay',
        height: 40
      },
      // Create order
      createOrder: async () => {
        setLoading(true);
        try {
          // Call your backend to create the order
          const response = await fetch('/api/paypal/create-deposit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              moneyPoolId,
              amount,
              currency
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create order');
          }

          const data = await response.json();
          setOrderID(data.orderId);
          return data.orderId;
        } catch (error) {
          console.error('Error creating PayPal order:', error);
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to create PayPal order',
            variant: 'destructive'
          });
          throw error;
        } finally {
          setLoading(false);
        }
      },
      // Handle approval
      onApprove: async (data: any, actions: any) => {
        try {
          // The payment is processed or authorized
          const details = await actions.order.capture();

          toast({
            title: 'Payment Successful',
            description: `Transaction completed successfully`,
            variant: 'default'
          });

          if (onSuccess) {
            onSuccess(details);
          }

          return details;
        } catch (error) {
          console.error('Error capturing PayPal payment:', error);
          toast({
            title: 'Payment Error',
            description: 'There was an error processing your payment',
            variant: 'destructive'
          });

          if (onError) {
            onError(error);
          }

          throw error;
        }
      },
      // Handle cancellation
      onCancel: () => {
        toast({
          title: 'Payment Cancelled',
          description: 'You cancelled the payment process',
          variant: 'default'
        });

        if (onCancel) {
          onCancel();
        }
      },
      // Handle errors
      onError: (error: any) => {
        console.error('PayPal error:', error);
        toast({
          title: 'Payment Error',
          description: 'There was an error with PayPal',
          variant: 'destructive'
        });

        if (onError) {
          onError(error);
        }
      }
    }).render('#paypal-button-container');
  }, [paypalLoaded, amount, currency, moneyPoolId, toast, onSuccess, onError, onCancel]);

  return (
    <div className="w-full">
      {/* PayPal Button Container */}
      <div id="paypal-button-container"></div>

      {!paypalLoaded && (
        <div className="p-4 text-center">
          <div className="animate-pulse bg-gray-700 h-10 rounded-md mb-2"></div>
          <p className="text-gray-400 text-sm">Loading PayPal...</p>
        </div>
      )}

      <div className="mt-4 text-center text-sm text-gray-400">
        By clicking the PayPal button, you agree to contribute {amount} {currency} to the prize pool.
      </div>
    </div>
  );
}
