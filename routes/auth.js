const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { signToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const { DatabaseManager } = require('../data/database');

function createAuthRouter(db) {
  const router = express.Router();

  // POST /api/auth/register
  router.post('/register', async (req, res) => {
    try {
      const { email, password, displayName, display_name } = req.body;
      const name = displayName || display_name || email.split('@')[0];

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const existing = await db.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = await db.createUser(email, passwordHash, name);

      // 自动创建订阅（free tier）
      await db.createSubscription(userId, 'free');

      // 自动创建设置（默认空）
      await db.createUserSettings(userId);

      const token = signToken({ userId, email, role: 'user' });

      res.status(201).json({
        success: true,
        token,
        user: { id: userId, email, displayName: name, role: 'user' }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await db.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is disabled' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      await db.updateUserLogin(user.id);
      const token = signToken({ userId: user.id, email: user.email, role: user.role });

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/auth/me
  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await db.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/auth/api-keys
  router.get('/api-keys', authenticate, async (req, res) => {
    try {
      const keys = await db.getApiKeysByUser(req.user.userId);
      res.json({ success: true, keys });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/auth/api-keys
  router.post('/api-keys', authenticate, async (req, res) => {
    try {
      const { name } = req.body;
      const rawKey = `mg_${crypto.randomBytes(24).toString('hex')}`;
      const keyHash = await bcrypt.hash(rawKey, 6);

      const id = await db.createApiKey(req.user.userId, keyHash, name || 'Default');

      res.status(201).json({
        success: true,
        key: { id, name: name || 'Default', apiKey: rawKey }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/auth/api-keys/:id
  router.delete('/api-keys/:id', authenticate, async (req, res) => {
    try {
      const changes = await db.revokeApiKey(parseInt(req.params.id), req.user.userId);
      if (changes === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
