/**
 * Auth - 认证中间件 + JWT 工具单元测试
 *
 * 测试 JWT 签名/验证、authenticate 和 optionalAuth 中间件
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { signToken, verifyToken } = require('../utils/jwt');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { createMockRes } = require('./test-helpers');

describe('JWT Utils', () => {
  // ==================== signToken ====================

  describe('signToken', () => {
    it('should sign a token with payload', () => {
      const token = signToken({ userId: 1, role: 'admin' });
      assert.ok(token);
      assert.strictEqual(typeof token, 'string');
      // JWT has 3 parts separated by dots
      assert.strictEqual(token.split('.').length, 3);
    });

    it('should produce different tokens for different payloads', () => {
      const t1 = signToken({ userId: 1 });
      const t2 = signToken({ userId: 2 });
      assert.notStrictEqual(t1, t2);
    });
  });

  // ==================== verifyToken ====================

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const payload = { userId: 42, role: 'user' };
      const token = signToken(payload);
      const decoded = verifyToken(token);
      assert.strictEqual(decoded.userId, 42);
      assert.strictEqual(decoded.role, 'user');
      assert.ok(decoded.iat);
      assert.ok(decoded.exp);
    });

    it('should throw on invalid token', () => {
      assert.throws(() => verifyToken('invalid-token'), /jwt/i);
    });

    it('should throw on tampered token', () => {
      const token = signToken({ userId: 1 });
      const parts = token.split('.');
      parts[2] = 'tampered';
      assert.throws(() => verifyToken(parts.join('.')), /signature|JsonWebToken/i);
    });

    it('should throw on empty token', () => {
      assert.throws(() => verifyToken(''), /jwt/i);
    });
  });

  // ==================== authenticate Middleware ====================

  describe('authenticate middleware', () => {
    it('should pass with valid Bearer token', () => {
      const token = signToken({ userId: 1, role: 'user' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const { res } = createMockRes();
      let nextCalled = false;

      authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user.userId, 1);
    });

    it('should reject request without authorization header', () => {
      const req = { headers: {} };
      const { res, calls } = createMockRes();

      authenticate(req, res, () => { assert.fail('should not call next'); });

      assert.strictEqual(calls[0].method, 'status');
      assert.strictEqual(calls[0].args[0], 401);
    });

    it('should reject request with non-Bearer authorization', () => {
      const req = { headers: { authorization: 'Basic xyz' } };
      const { res, calls } = createMockRes();

      authenticate(req, res, () => { assert.fail('should not call next'); });

      assert.strictEqual(calls[0].method, 'status');
      assert.strictEqual(calls[0].args[0], 401);
    });

    it('should reject invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const { res, calls } = createMockRes();

      authenticate(req, res, () => { assert.fail('should not call next'); });

      assert.strictEqual(calls[0].method, 'status');
      assert.strictEqual(calls[0].args[0], 401);
      assert.strictEqual(calls[1].args[0].error, 'Invalid or expired token');
    });

    it('should reject expired token', async () => {
      // Create a token with 0s expiry
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 1 },
        process.env.JWT_SECRET || 'matrixgrow-dev-secret-change-in-production',
        { expiresIn: '0s' }
      );

      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const { res, calls } = createMockRes();

      // Small delay to ensure expiration
      await new Promise(r => setTimeout(r, 100));

      authenticate(req, res, () => { assert.fail('should not call next'); });

      // Should be rejected
      const statusCall = calls.find(c => c.method === 'status');
      assert.ok(statusCall, 'status() should have been called');
    });
  });

  // ==================== optionalAuth Middleware ====================

  describe('optionalAuth middleware', () => {
    it('should set user when valid token provided', () => {
      const token = signToken({ userId: 5 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const { res } = createMockRes();
      let nextCalled = false;

      optionalAuth(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user.userId, 5);
    });

    it('should set user to null when no auth header', () => {
      const req = { headers: {} };
      const { res } = createMockRes();
      let nextCalled = false;

      optionalAuth(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user, null);
    });

    it('should set user to null when invalid token', () => {
      const req = { headers: { authorization: 'Bearer bad-token' } };
      const { res } = createMockRes();
      let nextCalled = false;

      optionalAuth(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user, null);
    });

    it('should always call next regardless of token validity', () => {
      const req = { headers: {} };
      const { res } = createMockRes();
      let nextCalled = false;

      optionalAuth(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
    });
  });
});
