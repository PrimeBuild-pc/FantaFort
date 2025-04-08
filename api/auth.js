const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const crypto = require('crypto');
const { promisify } = require('util');
const { supabase } = require('./supabase');

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
  const [salt, key] = storedHash.split(':');
  const derivedKey = await scryptAsync(password, salt, 64);
  return crypto.timingSafeEqual(
    Buffer.from(key, 'hex'),
    derivedKey
  );
}

// Setup authentication
function setupAuth(app) {
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Passport local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Get user from Supabase
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .limit(1);

        if (error) throw error;

        const user = users.length > 0 ? users[0] : null;

        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        }

        // First try secure password comparison
        if (await comparePasswords(password, user.password)) {
          return done(null, user);
        }

        // Fallback to direct comparison for development (if password isn't hashed)
        if (user.password === password) {
          return done(null, user);
        }

        return done(null, false, { message: "Incorrect password" });
      } catch (error) {
        console.error('Authentication error:', error);
        return done(error);
      }
    }),
  );

  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      done(null, user);
    } catch (error) {
      console.error('Deserialize user error:', error);
      done(error);
    }
  });

  // Login route
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json({
      id: req.user.id,
      username: req.user.username,
      coins: req.user.coins,
      teamId: req.user.team_id,
      avatar: req.user.avatar,
      email: req.user.email
    });
  });

  // Register route
  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if user exists
      const { data: existingUsers, error: queryError } = await supabase
        .from('users')
        .select('id')
        .eq('username', req.body.username)
        .limit(1);

      if (queryError) throw queryError;

      if (existingUsers && existingUsers.length > 0) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash the password for security
      const hashedPassword = await hashPassword(req.body.password);

      // Create user in Supabase
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          username: req.body.username,
          password: hashedPassword,
          email: req.body.email || null,
          coins: 2500, // Default starting coins
          team_id: null,
          avatar: null,
          is_public_profile: false
        })
        .select()
        .single();

      if (error) throw error;

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          id: user.id,
          username: user.username,
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({
        id: req.user.id,
        username: req.user.username,
        coins: req.user.coins,
        teamId: req.user.team_id,
        avatar: req.user.avatar,
        email: req.user.email
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });
}

module.exports = { setupAuth, hashPassword, comparePasswords };
