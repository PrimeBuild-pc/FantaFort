const { supabase } = require('./supabase');
const { v4: uuidv4 } = require('uuid');

// Setup prize pool routes
function setupPrizePoolRoutes(app) {
  // Get team prize pool
  app.get("/api/team/:teamId/prize-pool", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { teamId } = req.params;
      
      // Check if user is a member of the team
      const { data: teamMember, error: teamMemberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', req.session.userId)
        .single();
      
      if (teamMemberError && teamMemberError.code !== 'PGRST116') {
        throw teamMemberError;
      }
      
      if (!teamMember) {
        return res.status(403).json({ error: "You are not a member of this team" });
      }
      
      // Get prize pool information
      const { data: prizePool, error: prizePoolError } = await supabase
        .from('prize_pools')
        .select('*')
        .eq('team_id', teamId)
        .single();
      
      if (prizePoolError && prizePoolError.code !== 'PGRST116') {
        throw prizePoolError;
      }
      
      if (!prizePool) {
        return res.json({
          teamId,
          amount: 0,
          enabled: false,
          transactions: []
        });
      }
      
      // Get prize pool transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('prize_pool_transactions')
        .select('*')
        .eq('prize_pool_id', prizePool.id)
        .order('created_at', { ascending: false });
      
      if (transactionsError) {
        throw transactionsError;
      }
      
      res.json({
        id: prizePool.id,
        teamId: prizePool.team_id,
        amount: prizePool.amount,
        enabled: prizePool.enabled,
        createdAt: prizePool.created_at,
        updatedAt: prizePool.updated_at,
        transactions: transactions || []
      });
    } catch (error) {
      console.error("Get prize pool error:", error);
      res.status(500).json({ error: "Failed to get prize pool" });
    }
  });

  // Toggle prize pool enabled/disabled
  app.post("/api/team/:teamId/prize-pool/toggle", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { teamId } = req.params;
      const { enabled } = req.body;
      
      // Check if user is a team captain or admin
      const { data: teamMember, error: teamMemberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', req.session.userId)
        .single();
      
      if (teamMemberError) throw teamMemberError;
      
      if (!teamMember || (teamMember.role !== 'captain' && teamMember.role !== 'admin')) {
        return res.status(403).json({ error: "Only team captains or admins can manage prize pools" });
      }
      
      // Check if prize pool exists
      const { data: existingPrizePool, error: existingPrizePoolError } = await supabase
        .from('prize_pools')
        .select('id')
        .eq('team_id', teamId)
        .single();
      
      if (existingPrizePoolError && existingPrizePoolError.code !== 'PGRST116') {
        throw existingPrizePoolError;
      }
      
      let prizePoolId;
      
      if (!existingPrizePool) {
        // Create new prize pool
        const { data: newPrizePool, error: newPrizePoolError } = await supabase
          .from('prize_pools')
          .insert({
            id: uuidv4(),
            team_id: teamId,
            amount: 0,
            enabled: enabled
          })
          .select()
          .single();
        
        if (newPrizePoolError) throw newPrizePoolError;
        
        prizePoolId = newPrizePool.id;
      } else {
        // Update existing prize pool
        const { error: updateError } = await supabase
          .from('prize_pools')
          .update({ enabled: enabled })
          .eq('id', existingPrizePool.id);
        
        if (updateError) throw updateError;
        
        prizePoolId = existingPrizePool.id;
      }
      
      res.json({
        success: true,
        prizePoolId,
        enabled
      });
    } catch (error) {
      console.error("Toggle prize pool error:", error);
      res.status(500).json({ error: "Failed to toggle prize pool" });
    }
  });

  // Add funds to prize pool
  app.post("/api/team/:teamId/prize-pool/add", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { teamId } = req.params;
      const { transactionId, amount, paypalDetails } = req.body;
      
      if (!transactionId || !amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid transaction details" });
      }
      
      // Check if user is a member of the team
      const { data: teamMember, error: teamMemberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', req.session.userId)
        .single();
      
      if (teamMemberError) throw teamMemberError;
      
      if (!teamMember) {
        return res.status(403).json({ error: "You are not a member of this team" });
      }
      
      // Get prize pool
      const { data: prizePool, error: prizePoolError } = await supabase
        .from('prize_pools')
        .select('*')
        .eq('team_id', teamId)
        .single();
      
      if (prizePoolError && prizePoolError.code !== 'PGRST116') {
        throw prizePoolError;
      }
      
      let prizePoolId;
      let newTotal;
      
      if (!prizePool) {
        // Create new prize pool
        const { data: newPrizePool, error: newPrizePoolError } = await supabase
          .from('prize_pools')
          .insert({
            id: uuidv4(),
            team_id: teamId,
            amount: amount,
            enabled: true
          })
          .select()
          .single();
        
        if (newPrizePoolError) throw newPrizePoolError;
        
        prizePoolId = newPrizePool.id;
        newTotal = amount;
      } else {
        // Update existing prize pool
        const newAmount = prizePool.amount + amount;
        
        const { data: updatedPrizePool, error: updateError } = await supabase
          .from('prize_pools')
          .update({ amount: newAmount, enabled: true })
          .eq('id', prizePool.id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        
        prizePoolId = prizePool.id;
        newTotal = updatedPrizePool.amount;
      }
      
      // Record the transaction
      const { error: transactionError } = await supabase
        .from('prize_pool_transactions')
        .insert({
          id: uuidv4(),
          prize_pool_id: prizePoolId,
          user_id: req.session.userId,
          amount: amount,
          transaction_id: transactionId,
          payment_provider: 'paypal',
          payment_details: paypalDetails
        });
      
      if (transactionError) throw transactionError;
      
      res.json({
        success: true,
        prizePoolId,
        newTotal,
        transactionId
      });
    } catch (error) {
      console.error("Add to prize pool error:", error);
      res.status(500).json({ error: "Failed to add to prize pool" });
    }
  });

  // Get prize pool transactions
  app.get("/api/team/:teamId/prize-pool/transactions", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { teamId } = req.params;
      
      // Check if user is a member of the team
      const { data: teamMember, error: teamMemberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', req.session.userId)
        .single();
      
      if (teamMemberError) throw teamMemberError;
      
      if (!teamMember) {
        return res.status(403).json({ error: "You are not a member of this team" });
      }
      
      // Get prize pool
      const { data: prizePool, error: prizePoolError } = await supabase
        .from('prize_pools')
        .select('id')
        .eq('team_id', teamId)
        .single();
      
      if (prizePoolError && prizePoolError.code !== 'PGRST116') {
        throw prizePoolError;
      }
      
      if (!prizePool) {
        return res.json([]);
      }
      
      // Get transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('prize_pool_transactions')
        .select(`
          *,
          users:user_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq('prize_pool_id', prizePool.id)
        .order('created_at', { ascending: false });
      
      if (transactionsError) throw transactionsError;
      
      res.json(transactions || []);
    } catch (error) {
      console.error("Get prize pool transactions error:", error);
      res.status(500).json({ error: "Failed to get prize pool transactions" });
    }
  });
}

module.exports = { setupPrizePoolRoutes };
