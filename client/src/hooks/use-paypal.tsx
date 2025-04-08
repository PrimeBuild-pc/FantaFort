import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '../lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function usePaypal() {
  const { toast } = useToast();
  const [paypalReady, setPaypalReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  
  // Check if PayPal is configured on the server
  const { data: configStatus } = useQuery({
    queryKey: ['/api/paypal/config-status'],
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });
  
  // Prepare the PayPal JavaScript SDK
  useEffect(() => {
    if (configStatus?.configured) {
      setIsConfigured(true);
      
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || import.meta.env.PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;
      script.onload = () => {
        setPaypalReady(true);
      };
      script.onerror = () => {
        toast({
          title: 'PayPal error',
          description: 'Failed to load PayPal SDK',
          variant: 'destructive',
        });
      };
      
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [configStatus, toast]);
  
  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async ({ poolId, amount }: { poolId: string; amount: string }) => {
      const response = await apiRequest('POST', '/api/paypal/create-order', {
        poolId,
        amount,
      });
      return await response.json();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating order',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Capture payment mutation
  const capturePaymentMutation = useMutation({
    mutationFn: async ({ orderId, contributionId }: { orderId: string; contributionId: string }) => {
      const response = await apiRequest('POST', '/api/paypal/capture-payment', {
        orderId,
        contributionId,
      });
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/paypal/user/contributions'] });
      toast({
        title: 'Payment successful',
        description: 'Your contribution to the prize pool has been processed',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Payment failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Query to get user contributions
  const { 
    data: userContributions, 
    isLoading: contributionsLoading 
  } = useQuery({
    queryKey: ['/api/paypal/user/contributions'],
    enabled: isConfigured,
  });
  
  // Get money pool by tournament ID
  const getMoneyPoolByTournament = (tournamentId: string) => {
    return useQuery({
      queryKey: ['/api/paypal/pools/tournament', tournamentId],
      enabled: !!tournamentId && isConfigured,
    });
  };
  
  // Create money pool mutation
  const createMoneyPoolMutation = useMutation({
    mutationFn: async (poolData: { tournamentId: string; currency?: string }) => {
      const response = await apiRequest('POST', '/api/paypal/pools/create', poolData);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/paypal/pools/tournament', data.tournamentId] });
      toast({
        title: 'Money pool created',
        description: 'Prize pool has been created for the tournament',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create money pool',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Distribute prize mutation
  const distributePrizeMutation = useMutation({
    mutationFn: async ({ poolId, winnerId }: { poolId: string; winnerId: number }) => {
      const response = await apiRequest('POST', '/api/paypal/distribute-prize', {
        poolId,
        winnerId,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/paypal/pools/tournament', data.pool.tournamentId] });
      toast({
        title: 'Prize distributed',
        description: 'Prize has been distributed to the winner',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to distribute prize',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  return {
    isConfigured,
    paypalReady,
    createOrderMutation,
    capturePaymentMutation,
    userContributions,
    contributionsLoading,
    getMoneyPoolByTournament,
    createMoneyPoolMutation,
    distributePrizeMutation,
  };
}