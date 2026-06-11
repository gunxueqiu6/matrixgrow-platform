/**
 * Usage Meter - 用量计费模块单元测试
 *
 * 测试 AI 用量记录、配额检查、超额计费逻辑
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { UsageMeter } = require('../utils/usage-meter');
const { createMockDb } = require('./test-helpers');

// ==================== getPricing ====================

describe('UsageMeter - getPricing', () => {
  it('should return pricing for all types', () => {
    const pricing = UsageMeter.getPricing();
    assert.ok(pricing.image);
    assert.ok(pricing.video);
    assert.ok(pricing.text);
  });

  it('should have correct prices', () => {
    const pricing = UsageMeter.getPricing();
    assert.strictEqual(pricing.image.price, 0.05);
    assert.strictEqual(pricing.video.price, 2.0);
    assert.strictEqual(pricing.text.price, 0.001);
  });
});

// ==================== getTierLimits ====================

describe('UsageMeter - getTierLimits', () => {
  it('should have limits matching tier structure', () => {
    const limits = UsageMeter.getTierLimits();
    assert.ok(limits.free);
    assert.ok(limits.pro);
    assert.ok(limits.promax);
  });

  it('should have correct free tier limits', () => {
    const free = UsageMeter.getTierLimits().free;
    assert.strictEqual(free.aiImagesPerMonth, 10);
    assert.strictEqual(free.aiVideosPerMonth, 0);
    assert.strictEqual(free.aiTextPerMonth, Infinity);
  });

  it('should have correct pro tier limits', () => {
    const pro = UsageMeter.getTierLimits().pro;
    assert.strictEqual(pro.aiImagesPerMonth, 50);
    assert.strictEqual(pro.aiVideosPerMonth, 3);
    assert.strictEqual(pro.aiTextPerMonth, Infinity);
  });

  it('should have correct promax tier limits', () => {
    const promax = UsageMeter.getTierLimits().promax;
    assert.strictEqual(promax.aiImagesPerMonth, 200);
    assert.strictEqual(promax.aiVideosPerMonth, 10);
    assert.strictEqual(promax.aiTextPerMonth, Infinity);
  });
});

// ==================== recordUsage ====================

describe('UsageMeter - recordUsage', () => {
  it('should record AI usage successfully', async () => {
    const db = createMockDb();
    const result = await UsageMeter.recordUsage(db, 1, 'image', 'fal', 'flux-pro', 1, null);
    assert.strictEqual(result.success, true);
    assert.ok(result.logId);
  });

  it('should handle DB error gracefully', async () => {
    const db = createMockDb();
    db.recordAiUsage = async () => { throw new Error('DB error'); };
    const result = await UsageMeter.recordUsage(db, 1, 'image', 'fal', 'flux-pro', 1);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });

  it('should record different usage types', async () => {
    const db = createMockDb();
    const r1 = await UsageMeter.recordUsage(db, 1, 'image', 'fal', 'flux-pro', 2);
    const r2 = await UsageMeter.recordUsage(db, 1, 'video', 'heygen', 'default', 1);
    const r3 = await UsageMeter.recordUsage(db, 1, 'text', 'deepseek', 'deepseek-chat', 500);
    assert.strictEqual(r1.success, true);
    assert.strictEqual(r2.success, true);
    assert.strictEqual(r3.success, true);
  });
});

// ==================== calculateOverageCost ====================

describe('UsageMeter - calculateOverageCost', () => {
  it('should calculate image overage cost', async () => {
    const db = createMockDb();
    const cost = await UsageMeter.calculateOverageCost(db, 1, 'image', 10);
    assert.strictEqual(cost, 0.50); // 10 * 0.05
  });

  it('should calculate video overage cost', async () => {
    const db = createMockDb();
    const cost = await UsageMeter.calculateOverageCost(db, 1, 'video', 5);
    assert.strictEqual(cost, 10.0); // 5 * 2.0
  });

  it('should return 0 for unknown types', async () => {
    const db = createMockDb();
    const cost = await UsageMeter.calculateOverageCost(db, 1, 'unknown', 100);
    assert.strictEqual(cost, 0);
  });

  it('should return 0 for zero additional amount', async () => {
    const db = createMockDb();
    const cost = await UsageMeter.calculateOverageCost(db, 1, 'image', 0);
    assert.strictEqual(cost, 0);
  });
});

// ==================== getMonthlyStats ====================

describe('UsageMeter - getMonthlyStats', () => {
  it('should return monthly stats for free tier', async () => {
    const db = createMockDb({ monthlyUsage: { image: 5, video: 0, text: 1000 } });
    const stats = await UsageMeter.getMonthlyStats(db, 1);

    assert.strictEqual(stats.image.used, 5);
    assert.strictEqual(stats.image.limit, 10);
    assert.strictEqual(stats.image.cost, 0);

    assert.strictEqual(stats.video.used, 0);
    assert.strictEqual(stats.video.limit, 0);
    assert.strictEqual(stats.video.cost, 0);

    assert.strictEqual(stats.text.used, 1000);
    assert.strictEqual(stats.text.limit, Infinity);
    assert.strictEqual(stats.text.cost, 0);
  });

  it('should calculate overage cost when over limit', async () => {
    const db = createMockDb({ monthlyUsage: { image: 15, video: 0, text: 0 } });
    const stats = await UsageMeter.getMonthlyStats(db, 1);

    assert.strictEqual(stats.image.used, 15);
    assert.strictEqual(stats.image.limit, 10);
    // overage = 5, cost = 5 * 0.05 = 0.25
    assert.strictEqual(stats.image.cost, 0.25);
  });

  it('should handle DB error gracefully', async () => {
    const db = createMockDb();
    db.getSubscription = async () => { throw new Error('error'); };
    const stats = await UsageMeter.getMonthlyStats(db, 1);
    // Should return default stats on error
    assert.ok(stats.image);
    assert.strictEqual(stats.image.used, 0);
  });

  it('should return pro tier stats', async () => {
    const db = createMockDb({
      subscription: { tier: 'pro', platform_limit: 27, accounts_per_platform: 1 },
      monthlyUsage: { image: 30, video: 1, text: 500 },
    });
    const stats = await UsageMeter.getMonthlyStats(db, 1);

    assert.strictEqual(stats.image.limit, 50);
    assert.strictEqual(stats.video.limit, 3);
    assert.strictEqual(stats.image.cost, 0);
  });
});

// ==================== getUsageHistory ====================

describe('UsageMeter - getUsageHistory', () => {
  it('should return usage history with default limit', async () => {
    const db = createMockDb();
    const history = await UsageMeter.getUsageHistory(db, 1);
    assert.ok(Array.isArray(history));
  });

  it('should return usage history with custom limit', async () => {
    const db = createMockDb();
    await UsageMeter.recordUsage(db, 1, 'image', 'fal', 'flux', 1);
    await UsageMeter.recordUsage(db, 1, 'image', 'fal', 'flux', 1);
    const history = await UsageMeter.getUsageHistory(db, 1, 1);
    assert.strictEqual(history.length, 1);
  });
});

// ==================== hasEnoughQuota ====================

describe('UsageMeter - hasEnoughQuota', () => {
  it('should return true when quota is sufficient', async () => {
    const db = createMockDb({ monthlyUsage: { image: 5 } });
    const result = await UsageMeter.hasEnoughQuota(db, 1, 'image', 3);
    assert.strictEqual(result.hasQuota, true);
    assert.strictEqual(result.remaining, 5);
  });

  it('should return false when quota is exceeded', async () => {
    const db = createMockDb({ monthlyUsage: { image: 9 } });
    const result = await UsageMeter.hasEnoughQuota(db, 1, 'image', 2);
    assert.strictEqual(result.hasQuota, false);
    assert.strictEqual(result.overage, 1);
  });

  it('should return true for text with Infinity limit', async () => {
    const db = createMockDb({ monthlyUsage: { text: 999999 } });
    const result = await UsageMeter.hasEnoughQuota(db, 1, 'text', 1000);
    assert.strictEqual(result.hasQuota, true);
  });

  it('should handle video quota for free tier (limit=0)', async () => {
    const db = createMockDb({ monthlyUsage: { video: 0 } });
    const result = await UsageMeter.hasEnoughQuota(db, 1, 'video', 1);
    assert.strictEqual(result.hasQuota, false);
    assert.strictEqual(result.remaining, 0);
  });

  it('should handle DB error gracefully', async () => {
    const db = createMockDb();
    db.getSubscription = async () => { throw new Error('error'); };
    const result = await UsageMeter.hasEnoughQuota(db, 1, 'image', 1);
    assert.strictEqual(result.hasQuota, false);
    assert.ok(result.error);
  });

  it('should return hasQuota true for text type (no limit)', async () => {
    const db = createMockDb();
    const result = await UsageMeter.hasEnoughQuota(db, 1, 'text', 100);
    assert.strictEqual(result.hasQuota, true);
    // text type hits the default branch which returns early
    assert.strictEqual(result.remaining, undefined);
  });
});

// ==================== recordAndCheckQuota ====================

describe('UsageMeter - recordAndCheckQuota', () => {
  it('should record and return quota info when within limits', async () => {
    const db = createMockDb({ monthlyUsage: { image: 5 } });
    const result = await UsageMeter.recordAndCheckQuota(db, 1, 'image', 'fal', 'flux-pro', 2);

    assert.strictEqual(result.success, true);
    assert.ok(result.logId);
    assert.ok(result.quotaCheck);
    assert.strictEqual(result.quotaCheck.hasQuota, true);
    assert.strictEqual(result.overageCost, 0);
    assert.ok(result.pricing);
  });

  it('should record and calculate overage when over limit', async () => {
    const db = createMockDb({ monthlyUsage: { image: 9 } });
    const result = await UsageMeter.recordAndCheckQuota(db, 1, 'image', 'fal', 'flux-pro', 2);

    assert.strictEqual(result.success, true);
    assert.ok(result.logId);
    assert.strictEqual(result.quotaCheck.hasQuota, false);
    assert.strictEqual(result.overageCost, 0.05); // 1 overage * 0.05
  });

  it('should return error when quota check fails', async () => {
    const db = createMockDb();
    db.getSubscription = async () => { throw new Error('DB error'); };
    const result = await UsageMeter.recordAndCheckQuota(db, 1, 'image', 'fal', 'flux-pro', 1);

    assert.strictEqual(result.success, false);
  });

  it('should work with video type', async () => {
    const db = createMockDb({
      subscription: { tier: 'pro', platform_limit: 27, accounts_per_platform: 1 },
      monthlyUsage: { video: 1 },
    });
    const result = await UsageMeter.recordAndCheckQuota(db, 1, 'video', 'heygen', 'default', 1);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.quotaCheck.hasQuota, true);
  });

  it('should work with text type (no limit)', async () => {
    const db = createMockDb();
    const result = await UsageMeter.recordAndCheckQuota(db, 1, 'text', 'deepseek', 'deepseek-chat', 500);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.quotaCheck.hasQuota, true);
    assert.strictEqual(result.overageCost, 0);
  });
});
