import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { insertMoneyPoolSchema, insertMoneyPoolContributionSchema } from '@shared/schema';
import { z } from 'zod';
import * as paypalSDK from '@paypal/paypal-js';
import fetch from 'node-fetch';

// Set up PayPal client
function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured');
  }
  
  return {
    clientId,
    clientSecret
  };
}

// Simplified PayPal API client
async function createPayPalOrder(amount: string, currency: string = 'USD', description: string) {
  const { clientId, clientSecret } = getPayPalCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(
    'https://api-m.sandbox.paypal.com/v2/checkout/orders',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
            description
          },
        ],
      }),
    }
  );
  
  return await response.json();
}

async function capturePayPalOrder(orderId: string) {
  const { clientId, clientSecret } = getPayPalCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(
    `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
    }
  );
  
  return await response.json();
}

export const paypalRouter = Router();

// Middleware to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// Create a money pool for a tournament
paypalRouter.post('/pools/create', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const validatedData = insertMoneyPoolSchema.parse(req.body);
    
    // Check if the tournament exists
    const tournament = await storage.getTournament(validatedData.tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Check if pool already exists for this tournament
    const existingPool = await storage.getMoneyPoolByTournamentId(validatedData.tournamentId);
    if (existingPool) {
      return res.status(400).json({ error: 'A money pool already exists for this tournament' });
    }
    
    // Create the money pool
    const moneyPool = await storage.createMoneyPool(validatedData);
    
    res.status(201).json(moneyPool);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating money pool:', error);
    res.status(500).json({ error: 'Failed to create money pool' });
  }
});

// Get a money pool by tournament ID
paypalRouter.get('/pools/tournament/:tournamentId', async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    
    // Check if the tournament exists
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Get the money pool
    const moneyPool = await storage.getMoneyPoolByTournamentId(tournamentId);
    if (!moneyPool) {
      return res.status(404).json({ error: 'No money pool found for this tournament' });
    }
    
    // Get contributions for this pool
    const contributions = await storage.getMoneyPoolContributions(moneyPool.id);
    
    res.json({
      pool: moneyPool,
      contributions
    });
  } catch (error) {
    console.error('Error getting money pool:', error);
    res.status(500).json({ error: 'Failed to get money pool' });
  }
});

// Create PayPal order for contributing to a money pool
paypalRouter.post('/create-order', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { amount, poolId, currency = 'USD' } = req.body;
    
    if (!amount || !poolId) {
      return res.status(400).json({ error: 'Amount and poolId are required' });
    }
    
    // Check if the money pool exists and is still collecting
    const moneyPool = await storage.getMoneyPoolById(poolId);
    if (!moneyPool) {
      return res.status(404).json({ error: 'Money pool not found' });
    }
    
    if (moneyPool.status !== 'COLLECTING') {
      return res.status(400).json({ error: 'Money pool is not accepting contributions' });
    }
    
    // Create a PayPal order using direct API
    const order = await createPayPalOrder(
      amount.toString(),
      currency,
      `Contribution to prize pool: ${moneyPool.tournamentId}`
    );
    
    // Store transaction in our database
    const transaction = await storage.createPaypalTransaction({
      userId: req.user!.id,
      type: 'POOL_CONTRIBUTION',
      status: 'CREATED',
      paypalTransactionId: order.id,
      amount: amount.toString(),
      currency,
      paypalResponse: order
    });
    
    // Create a pending contribution
    const contribution = await storage.createMoneyPoolContribution({
      userId: req.user!.id,
      moneyPoolId: poolId,
      amount: amount.toString(),
      currency,
      status: 'PENDING',
      transactionId: transaction.id
    });
    
    res.json({
      orderId: order.id,
      contribution,
      transaction
    });
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    if (error.message && error.message.includes('credentials')) {
      return res.status(500).json({ error: 'PayPal is not properly configured' });
    }
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});

// Capture PayPal payment and complete contribution
paypalRouter.post('/capture-payment', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { orderId, contributionId } = req.body;
    
    if (!orderId || !contributionId) {
      return res.status(400).json({ error: 'OrderId and contributionId are required' });
    }
    
    // Get the contribution
    const contribution = await storage.getMoneyPoolContributions(contributionId);
    if (!contribution) {
      return res.status(404).json({ error: 'Contribution not found' });
    }
    
    // Get the transaction
    const transaction = await storage.getPaypalTransactionById(contribution[0].transactionId!);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Only the user who created the order can capture it
    if (transaction.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Capture the payment from PayPal using direct API
    const capture = await capturePayPalOrder(orderId);
    
    // Update transaction status
    const now = new Date();
    await storage.updatePaypalTransactionStatus(
      transaction.id,
      'COMPLETED',
      now,
      capture
    );
    
    // Update contribution status
    await storage.updateMoneyPoolContributionStatus(
      contributionId,
      'COMPLETED',
      transaction.id,
      now
    );
    
    // Get the money pool to return updated amount
    const moneyPool = await storage.getMoneyPoolById(contribution[0].moneyPoolId);
    
    res.json({
      success: true,
      status: 'COMPLETED',
      pool: moneyPool
    });
  } catch (error) {
    console.error('Error capturing PayPal payment:', error);
    res.status(500).json({ error: 'Failed to capture PayPal payment' });
  }
});

// Distribute prize money to the winner
paypalRouter.post('/distribute-prize', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { poolId, winnerId } = req.body;
    
    if (!poolId || !winnerId) {
      return res.status(400).json({ error: 'PoolId and winnerId are required' });
    }
    
    // Check if the money pool exists and is closed
    const moneyPool = await storage.getMoneyPoolById(poolId);
    if (!moneyPool) {
      return res.status(404).json({ error: 'Money pool not found' });
    }
    
    // Only admin or tournament creator can distribute prize
    const tournament = await storage.getTournament(moneyPool.tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Get the winning team
    const winningTeam = await storage.getTeam(winnerId);
    if (!winningTeam) {
      return res.status(404).json({ error: 'Winning team not found' });
    }
    
    // Get the winning team owner
    const winningUser = await storage.getUser(winningTeam.ownerId);
    if (!winningUser) {
      return res.status(404).json({ error: 'Winning team owner not found' });
    }
    
    // If the pool is already closed and distributed, cannot distribute again
    if (moneyPool.status === 'CLOSED' && moneyPool.distributed) {
      return res.status(400).json({ error: 'Prize has already been distributed' });
    }
    
    // If the pool is still collecting, close it first
    if (moneyPool.status === 'COLLECTING') {
      await storage.closeMoneyPool(poolId, winningTeam.ownerId);
    }
    
    // Create a transaction record for the prize distribution
    const transaction = await storage.createPaypalTransaction({
      userId: winningUser.id,
      type: 'PRIZE_DISTRIBUTION',
      status: 'COMPLETED',
      paypalTransactionId: `prize_${poolId}_${Date.now()}`,
      amount: moneyPool.totalAmount.toString(),
      currency: moneyPool.currency
    });
    
    // Update the money pool to mark as distributed
    const updatedPool = await storage.updateMoneyPool(poolId, {
      winnerId: winningUser.id,
      distributed: true
    });
    
    // In a real app, here you would use PayPal Payouts API to send money to the winner
    // This would require more complex setup with PayPal's business account and webhooks
    
    res.json({
      success: true,
      pool: updatedPool,
      transaction,
      message: 'Prize distribution has been recorded. In a production environment, this would trigger an actual PayPal payout to the winner.'
    });
  } catch (error) {
    console.error('Error distributing prize:', error);
    res.status(500).json({ error: 'Failed to distribute prize' });
  }
});

// Get user's contributions and transactions
paypalRouter.get('/user/contributions', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get user's contributions
    const contributions = await storage.getUserContributions(userId);
    
    // Get user's transactions
    const transactions = await storage.getUserPaypalTransactions(userId);
    
    res.json({
      contributions,
      transactions
    });
  } catch (error) {
    console.error('Error getting user contributions:', error);
    res.status(500).json({ error: 'Failed to get user contributions' });
  }
});

// Check PayPal configuration status
paypalRouter.get('/config-status', async (req: Request, res: Response) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  res.json({
    configured: !!(clientId && clientSecret),
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
  });
});