import { Router, Request, Response } from 'express';
import { paypalService } from './paypal-service';
import { supabaseStorage } from './supabase-storage';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();

// Validation schemas
const depositSchema = z.object({
  moneyPoolId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD')
});

const payoutSchema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  note: z.string().optional()
});

/**
 * Create a PayPal order for depositing to a money pool
 * POST /api/paypal/create-deposit
 */
router.post('/create-deposit', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Validate request body
    const result = depositSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid input data', details: result.error.format() });
    }
    
    const { moneyPoolId, amount, currency } = result.data;
    const userId = (req.user as any).id;
    
    // Check if money pool exists
    const moneyPool = await supabaseStorage.getMoneyPoolById(moneyPoolId);
    if (!moneyPool) {
      return res.status(404).json({ error: 'Money pool not found' });
    }
    
    // Create PayPal order
    const order = await paypalService.createDepositOrder(userId, moneyPoolId, amount, currency);
    
    res.json(order);
  } catch (error) {
    console.error('Error creating PayPal deposit:', error);
    res.status(500).json({ error: 'Failed to create PayPal deposit' });
  }
});

/**
 * Capture a PayPal payment after user approval
 * GET /api/paypal/capture
 */
router.get('/capture', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid token' });
    }
    
    // Capture the payment
    const captureResult = await paypalService.capturePayment(token);
    
    // Redirect to success page
    res.redirect(`/payment-success?id=${token}`);
  } catch (error) {
    console.error('Error capturing PayPal payment:', error);
    res.redirect('/payment-error');
  }
});

/**
 * Handle PayPal payment cancellation
 * GET /api/paypal/cancel
 */
router.get('/cancel', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid token' });
    }
    
    // Get transaction from database
    const { data: transactions } = await supabaseStorage.supabaseAdmin
      .from('paypal_transactions')
      .select('*')
      .eq('paypal_transaction_id', token)
      .limit(1);
    
    if (transactions && transactions.length > 0) {
      const transaction = transactions[0];
      
      // Update transaction status
      await supabaseStorage.updatePayPalTransactionStatus(
        transaction.id,
        'CANCELLED'
      );
    }
    
    // Redirect to cancel page
    res.redirect('/payment-cancelled');
  } catch (error) {
    console.error('Error handling PayPal cancellation:', error);
    res.redirect('/payment-error');
  }
});

/**
 * Create a money pool for a tournament
 * POST /api/paypal/create-money-pool
 */
router.post('/create-money-pool', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.user || !(req.user as any).isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { tournamentId, currency = 'USD' } = req.body;
    
    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID is required' });
    }
    
    // Check if tournament exists
    const tournament = await supabaseStorage.getTournamentById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Check if money pool already exists for this tournament
    const existingPool = await supabaseStorage.getMoneyPoolByTournamentId(tournamentId);
    if (existingPool) {
      return res.status(409).json({ error: 'Money pool already exists for this tournament' });
    }
    
    // Create money pool
    const moneyPool = await supabaseStorage.createMoneyPool({
      id: uuidv4(),
      tournamentId,
      currency
    });
    
    res.status(201).json(moneyPool);
  } catch (error) {
    console.error('Error creating money pool:', error);
    res.status(500).json({ error: 'Failed to create money pool' });
  }
});

/**
 * Create a payout to a tournament winner
 * POST /api/paypal/create-payout
 */
router.post('/create-payout', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.user || !(req.user as any).isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Validate request body
    const result = payoutSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid input data', details: result.error.format() });
    }
    
    const { email, amount, currency, note } = result.data;
    
    // Get user by email
    const user = await supabaseStorage.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create payout
    const payout = await paypalService.createPayout(
      user.id,
      email,
      amount,
      currency,
      note
    );
    
    res.json(payout);
  } catch (error) {
    console.error('Error creating PayPal payout:', error);
    res.status(500).json({ error: 'Failed to create PayPal payout' });
  }
});

/**
 * Check payout status
 * GET /api/paypal/payout-status/:payoutBatchId
 */
router.get('/payout-status/:payoutBatchId', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.user || !(req.user as any).isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { payoutBatchId } = req.params;
    
    if (!payoutBatchId) {
      return res.status(400).json({ error: 'Payout batch ID is required' });
    }
    
    // Check payout status
    const status = await paypalService.checkPayoutStatus(payoutBatchId);
    
    res.json(status);
  } catch (error) {
    console.error('Error checking payout status:', error);
    res.status(500).json({ error: 'Failed to check payout status' });
  }
});

/**
 * Distribute money pool to winner
 * POST /api/paypal/distribute-money-pool
 */
router.post('/distribute-money-pool', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated and is an admin
    if (!req.user || !(req.user as any).isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { moneyPoolId, winnerId } = req.body;
    
    if (!moneyPoolId || !winnerId) {
      return res.status(400).json({ error: 'Money pool ID and winner ID are required' });
    }
    
    // Check if money pool exists
    const moneyPool = await supabaseStorage.getMoneyPoolById(moneyPoolId);
    if (!moneyPool) {
      return res.status(404).json({ error: 'Money pool not found' });
    }
    
    // Check if winner exists
    const winner = await supabaseStorage.getUserById(winnerId);
    if (!winner) {
      return res.status(404).json({ error: 'Winner not found' });
    }
    
    // Distribute money pool
    const result = await supabaseStorage.distributeMoneyPool(moneyPoolId, winnerId);
    
    res.json(result);
  } catch (error) {
    console.error('Error distributing money pool:', error);
    res.status(500).json({ error: 'Failed to distribute money pool' });
  }
});

/**
 * Get user's PayPal transactions
 * GET /api/paypal/transactions
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const userId = (req.user as any).id;
    
    // Get user's transactions
    const transactions = await supabaseStorage.getUserPayPalTransactions(userId);
    
    res.json(transactions);
  } catch (error) {
    console.error('Error getting PayPal transactions:', error);
    res.status(500).json({ error: 'Failed to get PayPal transactions' });
  }
});

export const paypalRouter = router;
