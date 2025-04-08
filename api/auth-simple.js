const { supabase } = require('./supabase');
const crypto = require('crypto');
const { promisify } = require('util');

// Promisify scrypt
const scryptAsync = promisify(crypto.scrypt);

// Hash password
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return salt + ':' + derivedKey.toString('hex');
}

// Compare password with hash
async function comparePasswords(password, storedHash) {
  try {
    // Check if the hash contains a salt
    if (storedHash.includes(':')) {
      const [salt, key] = storedHash.split(':');
      const derivedKey = await scryptAsync(password, salt, 64);
      return crypto.timingSafeEqual(
        Buffer.from(key, 'hex'),
        derivedKey
      );
    } else {
      // Fallback for direct comparison (development only)
      return password === storedHash;
    }
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

// Setup authentication routes
function setupAuthRoutes(app) {
  // Login route
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Get user from Supabase
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .limit(1);
      
      if (error) throw error;
      
      const user = users.length > 0 ? users[0] : null;
      
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      // Verify password
      const isPasswordValid = await comparePasswords(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      // Create session
      req.session.userId = user.id;
      
      // Return user data (excluding password)
      const { password: _, ...userData } = user;
      res.json(userData);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: "Server error during login" });
    }
  });

  // Register route
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, email } = req.body;
      
      // Check if user exists
      const { data: existingUsers, error: queryError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .limit(1);
      
      if (queryError) throw queryError;
      
      if (existingUsers && existingUsers.length > 0) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Create user in Supabase
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          username,
          password: hashedPassword,
          email: email || null,
          coins: 2500, // Default starting coins
          team_id: null,
          avatar: null,
          is_public_profile: false
        })
        .select()
        .single();
      
      if (error) throw error;

      // Create session
      req.session.userId = user.id;
      
      // Return user data (excluding password)
      const { password: _, ...userData } = user;
      res.status(201).json(userData);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Server error during registration" });
    }
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/user", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Get user from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, coins, team_id, avatar, email, is_public_profile')
        .eq('id', req.session.userId)
        .single();
      
      if (error) throw error;
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user data
      res.json({
        id: user.id,
        username: user.username,
        coins: user.coins,
        teamId: user.team_id,
        avatar: user.avatar,
        email: user.email,
        isPublicProfile: user.is_public_profile
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: "Server error" });
    }
  });
}

module.exports = { setupAuthRoutes, hashPassword, comparePasswords };
