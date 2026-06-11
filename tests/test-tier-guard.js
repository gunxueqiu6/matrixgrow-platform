/**
 * Tier Guard - 订阅分级中间件单元测试
 *
 * 测试各 tier 的权限限制检查逻辑和 Express 中间件
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { TierGuard } = require('../utils/tier-guard');
const { createMockDb, createMockReq, createMockRes } = require('./test-helpers');

// ==================== getTierLimits ====================

describe('TierGuard - getTierLimits', () => {
  it('should return limits for all tiers', () => {
    const limits = TierGuard.getTierLimits();
    assert.ok(limits.free);
    assert.ok(limits.pro);
    assert.ok(limits.promax);
  });

  it('should have correct free tier limits', () => {
    const free = TierGuard.getTierLimits().free;
    assert.strictEqual(free.platforms, 3);
    assert.strictEqual(free.accountsPerPlatform, 1);
    assert.strictEqual(free.workflowLimit, 3);
    assert.strictEqual(free.aiImagesPerMonth, 10);
    assert.strictEqual(free.aiVideosPerMonth, 0);
    assert.strictEqual(free.scheduledTasks, 0);
    assert.strictEqual(free.apiKeys, 0);
    assert.strictEqual(free.whiteLabel, false);
  });

  it('should have correct pro tier limits', () => {
    const pro = TierGuard.getTierLimits().pro;
    assert.strictEqual(pro.platforms, 27);
    assert.strictEqual(pro.workflowLimit, 10);
    assert.strictEqual(pro.aiImagesPerMonth, 50);
    assert.strictEqual(pro.aiVideosPerMonth, 3);
    assert.strictEqual(pro.scheduledTasks, 5);
  });

  it('should have correct promax tier limits', () => {
    const promax = TierGuard.getTierLimits().promax;
    assert.strictEqual(promax.platforms, 27);
    assert.strictEqual(promax.accountsPerPlatform, 5);
    assert.strictEqual(promax.workflowLimit, 50);
    assert.strictEqual(promax.aiImagesPerMonth, 200);
    assert.strictEqual(promax.aiVideosPerMonth, 10);
    assert.strictEqual(promax.scheduledTasks, 20);
    assert.strictEqual(promax.apiKeys, 1);
  });

  it('should have progressive limits (free < pro < promax)', () => {
    const { free, pro, promax } = TierGuard.getTierLimits();
    assert.ok(pro.platforms >= free.platforms);
    assert.ok(pro.workflowLimit > free.workflowLimit);
    assert.ok(promax.aiImagesPerMonth > pro.aiImagesPerMonth);
    assert.ok(promax.scheduledTasks > pro.scheduledTasks);
  });
});

// ==================== checkPlatformLimit ====================

describe('TierGuard - checkPlatformLimit', () => {
  it('should allow adding platform when under limit', async () => {
    const db = createMockDb({ platformsCount: 1 });
    const result = await TierGuard.checkPlatformLimit(db, 1, 'v2ex');
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.platformsUsed, 1);
    assert.strictEqual(result.platformsLimit, 3);
  });

  it('should block when at platform limit', async () => {
    const db = createMockDb({ platformsCount: 3 });
    const result = await TierGuard.checkPlatformLimit(db, 1, 'newplatform');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.upgradeRequired);
    assert.ok(result.reason.includes('3'));
  });

  it('should block when at account-per-platform limit', async () => {
    const db = createMockDb({ platformsCount: 1, platformCount: 1 });
    const result = await TierGuard.checkPlatformLimit(db, 1, 'v2ex');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('1'));
  });

  it('should return not-allowed when no subscription found', async () => {
    const db = createMockDb({ subscription: null });
    const result = await TierGuard.checkPlatformLimit(db, 1, 'v2ex');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('未找到订阅'));
  });

  it('should use free tier limits when no subscription', async () => {
    const db = createMockDb({ subscription: null });
    const result = await TierGuard.checkPlatformLimit(db, 1, 'v2ex');
    // Even without subscription, should still check limits
    assert.strictEqual(result.allowed, false);
  });

  it('should apply pro tier limits', async () => {
    const db = createMockDb({
      subscription: { tier: 'pro', platform_limit: 27, accounts_per_platform: 1 },
      platformsCount: 20,
    });
    const result = await TierGuard.checkPlatformLimit(db, 1, 'reddit');
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.currentTier, 'pro');
  });

  it('should handle DB error gracefully', async () => {
    const db = createMockDb();
    db.getSubscription = async () => { throw new Error('DB connection failed'); };
    const result = await TierGuard.checkPlatformLimit(db, 1, 'v2ex');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('检查失败'));
  });
});

// ==================== checkWorkflowLimit ====================

describe('TierGuard - checkWorkflowLimit', () => {
  it('should allow creating workflow when under limit', async () => {
    const db = createMockDb({ workflowsCount: 1 });
    const result = await TierGuard.checkWorkflowLimit(db, 1);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.workflowsUsed, 1);
    assert.strictEqual(result.workflowsLimit, 3);
  });

  it('should block when at workflow limit', async () => {
    const db = createMockDb({ workflowsCount: 3 });
    const result = await TierGuard.checkWorkflowLimit(db, 1);
    assert.strictEqual(result.allowed, false);
    assert.ok(result.upgradeRequired);
    assert.ok(result.reason.includes('3'));
  });

  it('should allow many workflows for promax tier', async () => {
    const db = createMockDb({
      subscription: { tier: 'promax', platform_limit: 27, accounts_per_platform: 5 },
      workflowsCount: 45,
    });
    const result = await TierGuard.checkWorkflowLimit(db, 1);
    assert.strictEqual(result.allowed, true);
  });
});

// ==================== checkAiUsageLimit ====================

describe('TierGuard - checkAiUsageLimit', () => {
  it('should allow AI usage within limits', async () => {
    const db = createMockDb({ monthlyUsage: { image: 3 } });
    const result = await TierGuard.checkAiUsageLimit(db, 1, 'image', 1);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 7);
  });

  it('should block AI image generation when over limit', async () => {
    const db = createMockDb({ monthlyUsage: { image: 10 } });
    const result = await TierGuard.checkAiUsageLimit(db, 1, 'image', 1);
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('图片'));
  });

  it('should block AI video generation for free tier', async () => {
    const db = createMockDb({ monthlyUsage: { video: 0 } });
    const result = await TierGuard.checkAiUsageLimit(db, 1, 'video', 1);
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('视频'));
  });

  it('should allow unknown types without limit', async () => {
    const db = createMockDb();
    const result = await TierGuard.checkAiUsageLimit(db, 1, 'unknown_type', 100);
    assert.strictEqual(result.allowed, true);
  });

  it('should use pro tier limits', async () => {
    const db = createMockDb({
      subscription: { tier: 'pro', platform_limit: 27, accounts_per_platform: 1 },
      monthlyUsage: { image: 40 },
    });
    const result = await TierGuard.checkAiUsageLimit(db, 1, 'image', 5);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 10); // 50 limit - 40 used = 10 remaining
  });
});

// ==================== getTier ====================

describe('TierGuard - getTier', () => {
  it('should return tier info for a subscribed user', async () => {
    const db = createMockDb({
      subscription: { tier: 'pro', platform_limit: 27, accounts_per_platform: 1, started_at: '2024-01-01', expires_at: '2025-01-01' },
    });
    const result = await TierGuard.getTier(db, 1);
    assert.strictEqual(result.tier, 'pro');
    assert.strictEqual(result.platformLimit, 27);
    assert.strictEqual(result.accountsPerPlatform, 1);
  });

  it('should return free tier defaults when no subscription', async () => {
    const db = createMockDb({ subscription: null });
    const result = await TierGuard.getTier(db, 1);
    assert.strictEqual(result.tier, 'free');
    assert.strictEqual(result.platformLimit, 3);
  });

  it('should return free tier defaults on DB error', async () => {
    const db = createMockDb();
    db.getSubscription = async () => { throw new Error('error'); };
    const result = await TierGuard.getTier(db, 1);
    assert.strictEqual(result.tier, 'free');
  });
});

// ==================== Express Middleware ====================

describe('TierGuard - requirePlatformSlot middleware', () => {
  it('should pass when platform slot is available', async () => {
    const db = createMockDb({ platformsCount: 1 });
    const req = createMockReq({
      body: { platform: 'v2ex' },
      user: { userId: 1 },
    });
    req.app.locals.db = db;
    const { res } = createMockRes();
    let nextCalled = false;

    const middleware = TierGuard.requirePlatformSlot();
    await middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.ok(req.platformSlot);
    assert.strictEqual(req.platformSlot.allowed, true);
  });

  it('should reject when user is not logged in', async () => {
    const req = createMockReq({ body: { platform: 'v2ex' }, user: null });
    const { res, calls } = createMockRes();

    const middleware = TierGuard.requirePlatformSlot();
    await middleware(req, res, () => { assert.fail('should not call next'); });

    assert.strictEqual(calls[0].method, 'status');
    assert.strictEqual(calls[0].args[0], 401);
  });

  it('should reject when platform parameter is missing', async () => {
    const req = createMockReq({ body: {}, user: { userId: 1 } });
    const { res, calls } = createMockRes();

    const middleware = TierGuard.requirePlatformSlot();
    await middleware(req, res, () => { assert.fail('should not call next'); });

    assert.strictEqual(calls[0].method, 'status');
    assert.strictEqual(calls[0].args[0], 400);
  });

  it('should reject when platform limit is reached', async () => {
    const db = createMockDb({ platformsCount: 3 });
    const req = createMockReq({
      body: { platform: 'newplatform' },
      user: { userId: 1 },
    });
    req.app.locals.db = db;
    const { res, calls } = createMockRes();

    const middleware = TierGuard.requirePlatformSlot();
    await middleware(req, res, () => { assert.fail('should not call next'); });

    const jsonCall = calls.find(c => c.method === 'json');
    const statusCall = calls.find(c => c.method === 'status');
    assert.strictEqual(statusCall.args[0], 403);
    assert.ok(jsonCall.args[0].error.includes('3'));
  });
});

describe('TierGuard - requireWorkflowSlot middleware', () => {
  it('should pass when workflow slot is available', async () => {
    const db = createMockDb({ workflowsCount: 1 });
    const req = createMockReq({ user: { userId: 1 } });
    req.app.locals.db = db;
    const { res } = createMockRes();
    let nextCalled = false;

    const middleware = TierGuard.requireWorkflowSlot();
    await middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.ok(req.workflowSlot);
  });

  it('should reject when user is not logged in', async () => {
    const req = createMockReq({ user: null });
    const { res, calls } = createMockRes();

    const middleware = TierGuard.requireWorkflowSlot();
    await middleware(req, res, () => { assert.fail('should not call next'); });

    assert.strictEqual(calls[0].args[0], 401);
  });
});

describe('TierGuard - requireTier middleware', () => {
  it('should pass when user meets minimum tier', async () => {
    const db = createMockDb({
      subscription: { tier: 'pro', platform_limit: 27, accounts_per_platform: 1 },
    });
    const req = createMockReq({ user: { userId: 1 } });
    req.app.locals.db = db;
    const { res } = createMockRes();
    let nextCalled = false;

    const middleware = TierGuard.requireTier('free');
    await middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.ok(req.userTier);
  });

  it('should reject when user tier is below minimum', async () => {
    const db = createMockDb({ subscription: { tier: 'free' } });
    const req = createMockReq({ user: { userId: 1 } });
    req.app.locals.db = db;
    const { res, calls } = createMockRes();

    const middleware = TierGuard.requireTier('pro');
    await middleware(req, res, () => { assert.fail('should not call next'); });

    const statusCall = calls.find(c => c.method === 'status');
    assert.strictEqual(statusCall.args[0], 403);
  });

  it('should reject unauthenticated user', async () => {
    const req = createMockReq({ user: null });
    const { res, calls } = createMockRes();

    const middleware = TierGuard.requireTier('free');
    await middleware(req, res, () => { assert.fail('should not call next'); });

    assert.strictEqual(calls[0].args[0], 401);
  });
});

// ==================== getTierComparison ====================

describe('TierGuard - getTierComparison', () => {
  it('should return comparison data for all tiers', () => {
    const comparison = TierGuard.getTierComparison();
    assert.ok(comparison.tiers);
    assert.strictEqual(comparison.tiers.length, 3);

    const tiers = comparison.tiers;
    assert.strictEqual(tiers[0].id, 'free');
    assert.strictEqual(tiers[1].id, 'pro');
    assert.strictEqual(tiers[2].id, 'promax');
  });

  it('should have increasing prices', () => {
    const { tiers } = TierGuard.getTierComparison();
    assert.strictEqual(tiers[0].price, 0);
    assert.strictEqual(tiers[1].price, 99);
    assert.strictEqual(tiers[2].price, 299);
  });

  it('should include feature lists for each tier', () => {
    const { tiers } = TierGuard.getTierComparison();
    tiers.forEach(t => {
      assert.ok(Array.isArray(t.features));
      assert.ok(t.features.length > 0);
    });
  });
});
