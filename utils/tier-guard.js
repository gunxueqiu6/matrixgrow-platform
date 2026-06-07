/**
 * Tier Guard - 订阅分级中间件
 * 检查用户订阅等级和平台使用限制
 */

class TierGuard {
  /**
   * 检查用户是否可以添加新平台
   * @param {Object} db - 数据库实例
   * @param {number} userId - 用户 ID
   * @param {string} platform - 平台名称
   * @returns {Object} { allowed: boolean, reason?: string }
   */
  static async checkPlatformLimit(db, userId, platform) {
    try {
      // 获取订阅信息
      const subscription = await db.getSubscription(userId);

      if (!subscription) {
        return {
          allowed: false,
          reason: '未找到订阅信息'
        };
      }

      // 获取用户已绑定的平台数量
      const currentCount = await db.getUserPlatformsCount(userId);

      // 检查是否达到总平台限制
      if (currentCount >= subscription.platform_limit) {
        return {
          allowed: false,
          reason: `您已达到平台数量限制（${subscription.platform_limit}个）。升级到 Pro 版本可绑定更多平台。`,
          upgradeRequired: true,
          currentTier: subscription.tier,
          limit: subscription.platform_limit,
          current: currentCount
        };
      }

      // 检查同一平台账号数量限制
      const platformCount = await db.getPlatformCountForUser(userId, platform);

      if (platformCount >= subscription.accounts_per_platform) {
        return {
          allowed: false,
          reason: `您在该平台已达到账号数量限制（${subscription.accounts_per_platform}个）。升级到 ProMax 版本可绑定更多账号。`,
          upgradeRequired: true,
          currentTier: subscription.tier,
          limit: subscription.accounts_per_platform,
          current: platformCount
        };
      }

      return {
        allowed: true,
        currentTier: subscription.tier,
        platformsUsed: currentCount,
        platformsLimit: subscription.platform_limit,
        platformAccountsUsed: platformCount,
        platformAccountsLimit: subscription.accounts_per_platform
      };
    } catch (error) {
      return {
        allowed: false,
        reason: `检查失败: ${error.message}`
      };
    }
  }

  /**
   * Express 中间件：检查平台添加权限
   */
  static requirePlatformSlot(platformField = 'platform') {
    return async (req, res, next) => {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: '需要登录' });
      }

      const platform = req.body[platformField] || req.params[platformField];

      if (!platform) {
        return res.status(400).json({ error: '缺少平台参数' });
      }

      const result = await TierGuard.checkPlatformLimit(req.app.locals.db, userId, platform);

      if (!result.allowed) {
        return res.status(403).json({
          error: result.reason,
          upgradeRequired: result.upgradeRequired || false,
          currentTier: result.currentTier,
          limit: result.limit,
          current: result.current
        });
      }

      // 将检查结果附加到请求对象
      req.platformSlot = result;
      next();
    };
  }

  /**
   * 检查用户订阅等级
   */
  static async getTier(db, userId) {
    try {
      const subscription = await db.getSubscription(userId);

      if (!subscription) {
        return {
          tier: 'free',
          platformLimit: 3,
          accountsPerPlatform: 1
        };
      }

      return {
        tier: subscription.tier,
        platformLimit: subscription.platform_limit,
        accountsPerPlatform: subscription.accounts_per_platform,
        startedAt: subscription.started_at,
        expiresAt: subscription.expires_at
      };
    } catch (error) {
      return {
        tier: 'free',
        platformLimit: 3,
        accountsPerPlatform: 1
      };
    }
  }

  /**
   * Express 中间件：检查最小订阅等级
   */
  static requireTier(minTier) {
    const tierLevels = { free: 1, pro: 2, promax: 3 };

    return async (req, res, next) => {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: '需要登录' });
      }

      const userTier = await TierGuard.getTier(req.app.locals.db, userId);

      if ((tierLevels[userTier.tier] || 0) < (tierLevels[minTier] || 0)) {
        return res.status(403).json({
          error: `此功能需要 ${minTier} 或更高版本`,
          currentTier: userTier.tier,
          requiredTier: minTier
        });
      }

      req.userTier = userTier;
      next();
    };
  }

  /**
   * 获取订阅套餐对比信息
   */
  static getTierComparison() {
    return {
      tiers: [
        {
          id: 'free',
          name: '免费版',
          price: 0,
          features: [
            '3 个平台绑定',
            '每平台 1 个账号',
            '基础 AI 改写',
            '基本监控'
          ],
          limits: {
            platforms: 3,
            accountsPerPlatform: 1
          }
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 99,
          features: [
            '27+ 个平台绑定',
            '每平台 1 个账号',
            '高级 AI 改写',
            '全平台监控',
            '优先支持'
          ],
          limits: {
            platforms: 27,
            accountsPerPlatform: 1
          }
        },
        {
          id: 'promax',
          name: 'ProMax',
          price: 299,
          features: [
            '27+ 个平台绑定',
            '每平台 5 个账号',
            '高级 AI 改写',
            '全平台监控',
            '优先支持',
            '批量操作',
            '高级分析'
          ],
          limits: {
            platforms: 27,
            accountsPerPlatform: 5
          }
        }
      ]
    };
  }
}

module.exports = { TierGuard };
