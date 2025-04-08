import { supabase, supabaseAdmin } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { Database } from '@shared/supabase-types';

// Type definitions
type User = Database['public']['Tables']['users']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type TeamMember = Database['public']['Tables']['team_members']['Row'];
type Tournament = Database['public']['Tables']['tournaments']['Row'];
type PaypalTransaction = Database['public']['Tables']['paypal_transactions']['Row'];
type MoneyPool = Database['public']['Tables']['money_pools']['Row'];
type MoneyPoolContribution = Database['public']['Tables']['money_pool_contributions']['Row'];

/**
 * Supabase Storage Service
 * Handles all database operations using Supabase
 */
export class SupabaseStorage {
  /**
   * User Operations
   */

  // Create a new user
  async createUser(userData: { username: string; password: string; email?: string }): Promise<User | null> {
    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Insert user into Supabase
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          username: userData.username,
          password: hashedPassword,
          email: userData.email,
          coins: 1000, // Default starting coins
          is_public_profile: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  // Get user by ID
  async getUserById(userId: number): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  // Update user
  async updateUser(userId: number, userData: Partial<User>): Promise<User | null> {
    try {
      // If password is being updated, hash it
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(userData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  /**
   * Team Operations
   */

  // Create a new team
  async createTeam(teamData: { id: string; name: string; ownerId: number; description?: string; logo?: string }): Promise<Team | null> {
    try {
      // Insert team into Supabase
      const { data: team, error: teamError } = await supabaseAdmin
        .from('teams')
        .insert({
          id: teamData.id || uuidv4(),
          name: teamData.name,
          owner_id: teamData.ownerId,
          description: teamData.description,
          logo: teamData.logo,
          rank: 999, // Default rank
          points: 0, // Default points
          is_public: true
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add owner as team member
      const { error: memberError } = await supabaseAdmin
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: teamData.ownerId,
          role: 'OWNER'
        });

      if (memberError) throw memberError;

      // Update user with team ID
      const { error: userError } = await supabaseAdmin
        .from('users')
        .update({ team_id: team.id })
        .eq('id', teamData.ownerId);

      if (userError) throw userError;

      return team;
    } catch (error) {
      console.error('Error creating team:', error);
      return null;
    }
  }

  // Get team by ID
  async getTeamById(teamId: string): Promise<Team | null> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting team by ID:', error);
      return null;
    }
  }

  // Get team by user ID
  async getTeamByUserId(userId: number): Promise<Team | null> {
    try {
      // First get the user to find their team ID
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (!user.team_id) return null;

      // Get the team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', user.team_id)
        .single();

      if (teamError) throw teamError;
      return team;
    } catch (error) {
      console.error('Error getting team by user ID:', error);
      return null;
    }
  }

  // Update team
  async updateTeam(teamId: string, teamData: Partial<Team>): Promise<Team | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('teams')
        .update(teamData)
        .eq('id', teamId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating team:', error);
      return null;
    }
  }

  // Get team members
  async getTeamMembers(teamId: string): Promise<TeamMember[] | null> {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, users(username, avatar)')
        .eq('team_id', teamId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting team members:', error);
      return null;
    }
  }

  /**
   * Player Operations
   */

  // Get players by team ID
  async getPlayersByTeamId(teamId: string): Promise<Player[] | null> {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting players by team ID:', error);
      return null;
    }
  }

  // Add player to team
  async addPlayerToTeam(playerId: string, teamId: string): Promise<Player | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('players')
        .update({ team_id: teamId })
        .eq('id', playerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding player to team:', error);
      return null;
    }
  }

  /**
   * Tournament Operations
   */

  // Get all tournaments
  async getTournaments(): Promise<Tournament[] | null> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting tournaments:', error);
      return null;
    }
  }

  /**
   * PayPal Operations
   */

  // Create a PayPal transaction
  async createPayPalTransaction(transactionData: {
    id: string;
    paypalTransactionId: string;
    userId: number;
    amount: number;
    currency: string;
    type: string;
    status: string;
    paypalResponse?: any;
  }): Promise<PaypalTransaction | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('paypal_transactions')
        .insert({
          id: transactionData.id,
          paypal_transaction_id: transactionData.paypalTransactionId,
          user_id: transactionData.userId,
          amount: transactionData.amount,
          currency: transactionData.currency,
          type: transactionData.type,
          status: transactionData.status,
          paypal_response: transactionData.paypalResponse
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating PayPal transaction:', error);
      return null;
    }
  }

  // Update PayPal transaction status
  async updatePayPalTransactionStatus(
    transactionId: string,
    status: string,
    completedAt?: string
  ): Promise<PaypalTransaction | null> {
    try {
      const updateData: any = { status };
      if (completedAt) {
        updateData.completed_at = completedAt;
      }

      const { data, error } = await supabaseAdmin
        .from('paypal_transactions')
        .update(updateData)
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating PayPal transaction status:', error);
      return null;
    }
  }

  // Get user's PayPal transactions
  async getUserPayPalTransactions(userId: number): Promise<PaypalTransaction[] | null> {
    try {
      const { data, error } = await supabase
        .from('paypal_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user PayPal transactions:', error);
      return null;
    }
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  // Get tournament by ID
  async getTournamentById(tournamentId: string): Promise<Tournament | null> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting tournament by ID:', error);
      return null;
    }
  }

  // Get money pool by ID
  async getMoneyPoolById(moneyPoolId: string): Promise<MoneyPool | null> {
    try {
      const { data, error } = await supabase
        .from('money_pools')
        .select('*')
        .eq('id', moneyPoolId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting money pool by ID:', error);
      return null;
    }
  }

  // Get money pool by tournament ID
  async getMoneyPoolByTournamentId(tournamentId: string): Promise<MoneyPool | null> {
    try {
      const { data, error } = await supabase
        .from('money_pools')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'no rows returned'
      return data || null;
    } catch (error) {
      console.error('Error getting money pool by tournament ID:', error);
      return null;
    }
  }

  /**
   * Money Pool Operations
   */

  // Create a money pool for a tournament
  async createMoneyPool(poolData: {
    id: string;
    tournamentId: string;
    currency: string;
  }): Promise<MoneyPool | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('money_pools')
        .insert({
          id: poolData.id,
          tournament_id: poolData.tournamentId,
          total_amount: 0,
          currency: poolData.currency,
          status: 'COLLECTING',
          distributed: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating money pool:', error);
      return null;
    }
  }

  // Add contribution to money pool
  async addMoneyPoolContribution(contributionData: {
    id: string;
    moneyPoolId: string;
    userId: number;
    amount: number;
    currency: string;
    transactionId?: string;
  }): Promise<MoneyPoolContribution | null> {
    try {
      // Start a transaction
      const { data: contribution, error: contributionError } = await supabaseAdmin
        .from('money_pool_contributions')
        .insert({
          id: contributionData.id,
          money_pool_id: contributionData.moneyPoolId,
          user_id: contributionData.userId,
          amount: contributionData.amount,
          currency: contributionData.currency,
          transaction_id: contributionData.transactionId,
          status: 'PENDING'
        })
        .select()
        .single();

      if (contributionError) throw contributionError;

      // Update the money pool total
      const { error: poolError } = await supabaseAdmin.rpc('update_money_pool_amount', {
        pool_id: contributionData.moneyPoolId,
        amount_to_add: contributionData.amount
      });

      if (poolError) throw poolError;

      return contribution;
    } catch (error) {
      console.error('Error adding money pool contribution:', error);
      return null;
    }
  }

  // Update contribution status
  async updateContributionStatus(
    contributionId: string,
    status: string,
    completedAt?: string
  ): Promise<MoneyPoolContribution | null> {
    try {
      const updateData: any = { status };
      if (completedAt) {
        updateData.completed_at = completedAt;
      }

      const { data, error } = await supabaseAdmin
        .from('money_pool_contributions')
        .update(updateData)
        .eq('id', contributionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating contribution status:', error);
      return null;
    }
  }

  // Distribute money pool to winner
  async distributeMoneyPool(
    moneyPoolId: string,
    winnerId: number
  ): Promise<MoneyPool | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('money_pools')
        .update({
          status: 'DISTRIBUTED',
          winner_id: winnerId,
          distributed: true,
          closed_at: new Date().toISOString()
        })
        .eq('id', moneyPoolId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error distributing money pool:', error);
      return null;
    }
  }
}

// Create and export a singleton instance
export const supabaseStorage = new SupabaseStorage();
