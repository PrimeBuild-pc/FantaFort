import paypal from '@paypal/checkout-server-sdk';
import { v4 as uuidv4 } from 'uuid';
import { supabaseStorage } from './supabase-storage';
import { supabase } from './supabase';

// PayPal client configuration
const clientId = process.env.PAYPAL_CLIENT_ID || 'AYMphyqMo0Qsj1AzMz2e3PMnG_yYOA6la8XvaAOxCruGhPzSn2_1_xz7RZZKGKsHCAynBbGaZwnYWCDZ';
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'EC6FpAfnleFDuNPPhz6gOl1HfulB4W4gy-P6OfmMFK7M2BDyKMjb8AWHzGBwQs38kMyx86CDZ6UJ98Zu';

// Create PayPal environment
const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
const client = new paypal.core.PayPalHttpClient(environment);

/**
 * PayPal Service
 * Handles all PayPal-related operations
 */
export class PayPalService {
  /**
   * Create a PayPal order for depositing to a money pool
   *
   * @param userId User ID making the deposit
   * @param moneyPoolId Money pool ID
   * @param amount Amount to deposit
   * @param currency Currency code (default: USD)
   * @returns PayPal order details
   */
  async createDepositOrder(
    userId: number,
    moneyPoolId: string,
    amount: number,
    currency: string = 'USD'
  ) {
    try {
      // Create a new order
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');

      // Format amount with 2 decimal places
      const formattedAmount = amount.toFixed(2);

      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: formattedAmount
          },
          description: `Deposit to prize pool ${moneyPoolId}`,
          custom_id: `${userId}:${moneyPoolId}:deposit`
        }],
        application_context: {
          brand_name: 'FantaFort',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.APP_URL || 'http://localhost:5000'}/api/paypal/capture`,
          cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/api/paypal/cancel`
        }
      });

      // Execute the request
      const response = await client.execute(request);

      // Create a transaction record in the database
      const transactionId = uuidv4();
      await supabaseStorage.createPayPalTransaction({
        id: transactionId,
        paypalTransactionId: response.result.id,
        userId,
        amount,
        currency,
        type: 'DEPOSIT',
        status: 'PENDING',
        paypalResponse: response.result
      });

      return {
        transactionId,
        orderId: response.result.id,
        status: response.result.status,
        links: response.result.links
      };
    } catch (error) {
      console.error('Error creating PayPal deposit order:', error);
      throw error;
    }
  }

  /**
   * Capture a PayPal payment after user approval
   *
   * @param orderId PayPal order ID to capture
   * @returns Capture details
   */
  async capturePayment(orderId: string) {
    try {
      // Create capture request
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.prefer('return=representation');

      // Execute the request
      const response = await client.execute(request);

      // Get the original order details
      const orderDetailsRequest = new paypal.orders.OrdersGetRequest(orderId);
      const orderDetails = await client.execute(orderDetailsRequest);

      // Extract custom_id to get user and money pool info
      const customId = orderDetails.result.purchase_units[0].custom_id;
      const [userId, moneyPoolId, type] = customId.split(':');

      // Get transaction from database
      const { data: transactions } = await supabase
        .from('paypal_transactions')
        .select('*')
        .eq('paypal_transaction_id', orderId)
        .limit(1);

      if (!transactions || transactions.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = transactions[0];

      // Update transaction status
      await supabaseStorage.updatePayPalTransactionStatus(
        transaction.id,
        'COMPLETED',
        new Date().toISOString()
      );

      // If this is a deposit to a money pool, add the contribution
      if (type === 'deposit') {
        const contributionId = uuidv4();
        const amount = parseFloat(orderDetails.result.purchase_units[0].amount.value);
        const currency = orderDetails.result.purchase_units[0].amount.currency_code;

        await supabaseStorage.addMoneyPoolContribution({
          id: contributionId,
          moneyPoolId,
          userId: parseInt(userId),
          amount,
          currency,
          transactionId: transaction.id
        });

        // Update contribution status
        await supabaseStorage.updateContributionStatus(
          contributionId,
          'COMPLETED',
          new Date().toISOString()
        );
      }

      return {
        captureId: response.result.id,
        status: response.result.status,
        payerId: response.result.payer.payer_id,
        payerEmail: response.result.payer.email_address,
        amount: response.result.purchase_units[0].payments.captures[0].amount.value,
        currency: response.result.purchase_units[0].payments.captures[0].amount.currency_code
      };
    } catch (error) {
      console.error('Error capturing PayPal payment:', error);
      throw error;
    }
  }

  /**
   * Create a PayPal payout to a winner
   *
   * @param userId User ID receiving the payout
   * @param email PayPal email of the recipient
   * @param amount Amount to pay out
   * @param currency Currency code (default: USD)
   * @param note Note to include with the payout
   * @returns Payout details
   */
  async createPayout(
    userId: number,
    email: string,
    amount: number,
    currency: string = 'USD',
    note: string = 'FantaFort tournament prize'
  ) {
    try {
      // Create a unique batch ID
      const batchId = `PAYOUT_${uuidv4()}`;

      // Format amount with 2 decimal places
      const formattedAmount = amount.toFixed(2);

      // Create payout request
      const request = {
        sender_batch_header: {
          sender_batch_id: batchId,
          email_subject: 'You received a payout from FantaFort!',
          email_message: 'Congratulations! You have received a payout for winning a FantaFort tournament.'
        },
        items: [{
          recipient_type: 'EMAIL',
          amount: {
            value: formattedAmount,
            currency
          },
          note,
          receiver: email,
          sender_item_id: `PAYOUT_ITEM_${uuidv4()}`
        }]
      };

      // Execute the payout
      const response = await fetch('https://api-m.sandbox.paypal.com/v1/payments/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAccessToken()}`
        },
        body: JSON.stringify(request)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`PayPal payout error: ${result.message || 'Unknown error'}`);
      }

      // Create a transaction record in the database
      const transactionId = uuidv4();
      await supabaseStorage.createPayPalTransaction({
        id: transactionId,
        paypalTransactionId: result.batch_header.payout_batch_id,
        userId,
        amount,
        currency,
        type: 'PAYOUT',
        status: 'PROCESSING',
        paypalResponse: result
      });

      return {
        transactionId,
        payoutBatchId: result.batch_header.payout_batch_id,
        status: result.batch_header.batch_status,
        batchId
      };
    } catch (error) {
      console.error('Error creating PayPal payout:', error);
      throw error;
    }
  }

  /**
   * Get PayPal access token
   * @returns Access token
   */
  private async getAccessToken() {
    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        },
        body: 'grant_type=client_credentials'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`PayPal auth error: ${data.error_description || 'Unknown error'}`);
      }

      return data.access_token;
    } catch (error) {
      console.error('Error getting PayPal access token:', error);
      throw error;
    }
  }

  /**
   * Check payout status
   *
   * @param payoutBatchId Payout batch ID to check
   * @returns Payout status
   */
  async checkPayoutStatus(payoutBatchId: string) {
    try {
      const response = await fetch(`https://api-m.sandbox.paypal.com/v1/payments/payouts/${payoutBatchId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAccessToken()}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`PayPal payout status error: ${result.message || 'Unknown error'}`);
      }

      // Get transaction from database
      const { data: transactions } = await supabase
        .from('paypal_transactions')
        .select('*')
        .eq('paypal_transaction_id', payoutBatchId)
        .limit(1);

      if (transactions && transactions.length > 0) {
        const transaction = transactions[0];

        // Update transaction status
        if (result.batch_header.batch_status === 'SUCCESS') {
          await supabaseStorage.updatePayPalTransactionStatus(
            transaction.id,
            'COMPLETED',
            new Date().toISOString()
          );
        } else if (['DENIED', 'FAILED', 'CANCELED'].includes(result.batch_header.batch_status)) {
          await supabaseStorage.updatePayPalTransactionStatus(
            transaction.id,
            'FAILED'
          );
        }
      }

      return {
        status: result.batch_header.batch_status,
        items: result.items.map((item: any) => ({
          payoutItemId: item.payout_item_id,
          transactionId: item.transaction_id,
          status: item.transaction_status,
          amount: item.payout_item.amount.value,
          currency: item.payout_item.amount.currency
        }))
      };
    } catch (error) {
      console.error('Error checking PayPal payout status:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const paypalService = new PayPalService();
