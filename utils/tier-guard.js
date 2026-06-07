/**
 * Tier Guard - 订阅分级中间件
 * 检查用户订阅等级和平台使用限制
 */

class TierGuard {
  static getTierLimits() {
    return {
      free: {
        platforms: 3,
        accountsPerPlatform: 1,
        workflowLimit: 3,
        aiImagesPerMonth: 10,
        aiVideosPerMonth: 0,
        scheduledTasks: 0,
        apiKeys: 0,
        whiteLabel: false
      },
      pro: {
        platforms: 27,
        accountsPerPlatform: 1,
        workflowLimit: 10,
        aiImagesPerMonth: 50,
        aiVideosPerMonth: 3,
        scheduledTasks: 5,
        apiKeys: 0,
        whiteLabel: false
      },
      promax: {
        platforms: 27,
        accountsPerPlatform: 5,
        workflowLimit: 50,
        aiImagesPerMonth: 200,
        aiVideosPerMonth: 10,
        scheduledTasks: 20,
        apiKeys: 1,
        whiteLabel: false
      },
      studio: {
        platforms: 27,
        accountsPerPlatform: 10,
        workflowLimit: Infinity,
        aiImagesPerMonth: 1000,
        aiVideosPerMonth: 60,
        scheduledTasks: Infinity,
        apiKeys: 5,
        whiteLabel: true
      }
    };
  }
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
      const tier = subscription?.tier || 'free';
      const limits = this.getTierLimits()[tier];

      if (!subscription) {
        return {
          allowed: false,
          reason: '未找到订阅信息'
        };
      }

      // 获取用户已绑定的平台数量
      const currentCount = await db.getUserPlatformsCount(userId);

      // 检查是否达到总平台限制
      if (currentCount >= limits.platforms) {
        return {
          allowed: false,
          reason: `您已达到平台数量限制（${limits.platforms}个）。升级到更高版本可绑定更多平台。`,
          upgradeRequired: true,
          currentTier: tier,
          limit: limits.platforms,
          current: currentCount
        };
      }

      // 检查同一平台账号数量限制
      const platformCount = await db.getPlatformCountForUser(userId, platform);

      if (platformCount >= limits.accountsPerPlatform) {
        return {
          allowed: false,
          reason: `您在该平台已达到账号数量限制（${limits.accountsPerPlatform}个）。升级到更高版本可绑定更多账号。`,
          upgradeRequired: true,
          currentTier: tier,
          limit: limits.accountsPerPlatform,
          current: platformCount
        };
      }

      return {
        allowed: true,
        currentTier: tier,
        platformsUsed: currentCount,
        platformsLimit: limits.platforms,
        platformAccountsUsed: platformCount,
        platformAccountsLimit: limits.accountsPerPlatform
      };
    } catch (error) {
      return {
        allowed: false,
        reason: `检查失败: ${error.message}`
      };
    }
  }

  /**
   * 检查用户是否可以添加新工作流
   */
  static async checkWorkflowLimit(db, userId) {
    try {
      const subscription = await db.getSubscription(userId);
      const tier = subscription?.tier || 'free';
      const limits = this.getTierLimits()[tier];
      const currentCount = await db.countUserWorkflows(userId);

      if (limits.workflowLimit !== Infinity && currentCount >= limits.workflowLimit) {
        return {
          allowed: false,
          reason: `您已达到工作流数量限制（${limits.workflowLimit}个）。升级到更高版本可创建更多工作流。`,
          upgradeRequired: true,
          currentTier: tier,
          limit: limits.workflowLimit,
          current: currentCount
        };
      }

      return {
        allowed: true,
        currentTier: tier,
        workflowsUsed: currentCount,
        workflowsLimit: limits.workflowLimit
      };
    } catch (error) {
      return {
        allowed: false,
        reason: `检查失败: ${error.message}`
      };
    }
  }

  /**
   * 检查 AI 使用限制
   */
  static async checkAiUsageLimit(db, userId, type, amount = 1) {
    try {
      const subscription = await db.getSubscription(userId);
      const tier = subscription?.tier || 'free';
      const limits = this.getTierLimits()[tier];
      const currentUsage = await db.getMonthlyUsage(userId, type);
      let limit;

      switch (type) {
        case 'image':
          limit = limits.aiImagesPerMonth;
          break;
        case 'video':
          limit = limits.aiVideosPerMonth;
          break;
        default:
          return { allowed: true };
      }

      if (limit !== Infinity && currentUsage + amount > limit) {
        return {
          allowed: false,
          reason: `您已达到${type === 'image' ? '图片' : '视频'}生成限制（本月${limit}个）。升级到更高版本可获得更多配额。`,
          upgradeRequired: true,
          currentTier: tier,
          limit,
          current: currentUsage
        };
      }

      return {
        allowed: true,
        currentTier: tier,
        used: currentUsage,
        limit,
        remaining: limit - currentUsage
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
   * Express 中间件：检查工作流创建权限
   */
  static requireWorkflowSlot() {
    return async (req, res, next) => {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: '需要登录' });
      }

      const result = await TierGuard.checkWorkflowLimit(req.app.locals.db, userId);

      if (!result.allowed) {
        return res.status(403).json({
          error: result.reason,
          upgradeRequired: result.upgradeRequired || false,
          currentTier: result.currentTier,
          limit: result.limit,
          current: result.current
        });
      }

      req.workflowSlot = result;
      next();
    };
  }

  /**
   * Express 中间件：检查最小订阅等级
   */
  static requireTier(minTier) {
    const tierLevels = { free: 1, pro: 2, promax: 3, studio: 4 };

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
            '3 个工作流',
            '10 张 AI 图片/月',
            '基本监控'
          ],
          limits: {
            platforms: 3,
            accountsPerPlatform: 1,
            workflows: 3,
            aiImagesPerMonth: 10,
            aiVideosPerMonth: 0,
            scheduledTasks: 0,
            apiKeys: 0
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
            '10 个工作流',
            '50 张 AI 图片/月',
            '3 分钟 AI 视频/月',
            '5 个定时任务',
            '全平台监控',
            '邮件支持'
          ],
          limits: {
            platforms: 27,
            accountsPerPlatform: 1,
            workflows: 10,
            aiImagesPerMonth: 50,
            aiVideosPerMonth: 3,
            scheduledTasks: 5,
            apiKeys: 0
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
            '50 个工作流',
            '200 张 AI 图片/月',
            '10 分钟 AI 视频/月',
            '20 个定时任务',
            'Excel 分析导出',
            '1 个 API Key',
            '优先支持',
            '批量操作',
            '高级分析'
          ],
          limits: {
            platforms: 27,
            accountsPerPlatform: 5,
            workflows: 50,
            aiImagesPerMonth: 200,
            aiVideosPerMonth: 10,
            scheduledTasks: 20,
            apiKeys: 1
          }
        },
        {
          id: 'studio',
          name: 'Studio',
          price: 999,
          features: [
            '27+ 个平台绑定',
            '每平台 10 个账号',
            '高级 AI 改写',
            '无限工作流',
            '1000 张 AI 图片/月',
            '60 分钟 AI 视频/月',
            '无限定时任务',
            'API 分析导出',
            '5 个 API Key',
            '白标功能',
            '专属支持',
            '批量操作',
            '高级分析'
          ],
          limits: {
            platforms: 27,
            accountsPerPlatform: 10,
            workflows: Infinity,
            aiImagesPerMonth: 1000,
            aiVideosPerMonth: 60,
            scheduledTasks: Infinity,
            apiKeys: 5,
            whiteLabel: true
          }
        }
      ]
    };
  }
}

module.exports = { TierGuard };
