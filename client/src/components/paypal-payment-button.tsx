import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';

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

  // Create a PayPal order
  const createOrder = async () => {
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
  };

  // Handle successful payment
  const handleApprove = async (data: any, actions: any) => {
    try {
      // The payment is processed or authorized
      const details = await actions.order.capture();
      
      toast({
        title: 'Payment Successful',
        description: `Transaction completed by ${details.payer.name.given_name}`,
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
  };

  // Handle payment cancellation
  const handleCancel = () => {
    toast({
      title: 'Payment Cancelled',
      description: 'You cancelled the payment process',
      variant: 'default'
    });
    
    if (onCancel) {
      onCancel();
    }
  };

  // Handle payment error
  const handleError = (error: any) => {
    console.error('PayPal error:', error);
    toast({
      title: 'Payment Error',
      description: 'There was an error with PayPal',
      variant: 'destructive'
    });
    
    if (onError) {
      onError(error);
    }
  };

  return (
    <div className="w-full">
      <PayPalScriptProvider options={{
        clientId: 'AYMphyqMo0Qsj1AzMz2e3PMnG_yYOA6la8XvaAOxCruGhPzSn2_1_xz7RZZKGKsHCAynBbGaZwnYWCDZ',
        currency,
        intent: 'capture'
      }}>
        <PayPalButtons
          style={{
            color: 'blue',
            shape: 'rect',
            label: 'pay',
            height: 40
          }}
          disabled={loading}
          forceReRender={[amount, currency, moneyPoolId]}
          createOrder={createOrder}
          onApprove={handleApprove}
          onCancel={handleCancel}
          onError={handleError}
        />
      </PayPalScriptProvider>
      
      <div className="mt-4 text-center text-sm text-gray-400">
        By clicking the PayPal button, you agree to contribute {amount} {currency} to the prize pool.
      </div>
    </div>
  );
}
