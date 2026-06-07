/**
 * Usage Meter - 用量计费模块
 * 记录和计算 AI 使用量，处理套餐外额外计费
 */

class UsageMeter {
  static getPricing() {
    return {
      image: { price: 0.05, unit: '张' },
      video: { price: 2.0, unit: '分钟' },
      text: { price: 0.001, unit: '千字符' }
    };
  }

  /**
   * 记录 AI 使用量
   * @param {Object} db - 数据库实例
   * @param {number} userId - 用户 ID
   * @param {string} type - 使用类型 (image/video/text)
   * @param {string} provider - 提供商 (fal/replicate/heygen等)
   * @param {string} model - 模型名称
   * @param {number} amount - 使用量
   * @param {number} workflowId - 关联的工作流 ID (可选)
   */
  static async recordUsage(db, userId, type, provider, model, amount, workflowId = null) {
    try {
      const unit = this.getPricing()[type]?.unit || '次';
      const logId = await db.recordAiUsage(userId, type, provider, model, amount, unit, workflowId);
      return { success: true, logId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 计算套餐外额外费用
   * @param {Object} db - 数据库实例
   * @param {number} userId - 用户 ID
   * @param {string} type - 使用类型
   * @param {number} additionalAmount - 额外使用量
   */
  static async calculateOverageCost(db, userId, type, additionalAmount) {
    const pricing = this.getPricing()[type];
    if (!pricing) return 0;

    return additionalAmount * pricing.price;
  }

  /**
   * 获取用户当月使用统计
   */
  static async getMonthlyStats(db, userId) {
    const stats = {
      image: { used: 0, limit: 0, cost: 0 },
      video: { used: 0, limit: 0, cost: 0 },
      text: { used: 0, limit: Infinity, cost: 0 }
    };

    try {
      const subscription = await db.getSubscription(userId);
      const tier = subscription?.tier || 'free';
      const tierLimits = this.getTierLimits()[tier];

      for (const type of ['image', 'video', 'text']) {
        const used = await db.getMonthlyUsage(userId, type);
        stats[type].used = used;
        stats[type].limit = tierLimits[`ai${type.charAt(0).toUpperCase() + type.slice(1)}PerMonth`] || Infinity;
        
        if (stats[type].used > stats[type].limit && stats[type].limit !== Infinity) {
          const overage = stats[type].used - stats[type].limit;
          stats[type].cost = await this.calculateOverageCost(db, userId, type, overage);
        }
      }
    } catch (error) {
      console.error('获取月度统计失败:', error);
    }

    return stats;
  }

  /**
   * 获取套餐限制（与 tier-guard 保持一致）
   */
  static getTierLimits() {
    return {
      free: {
        aiImagesPerMonth: 10,
        aiVideosPerMonth: 0,
        aiTextPerMonth: Infinity
      },
      pro: {
        aiImagesPerMonth: 50,
        aiVideosPerMonth: 3,
        aiTextPerMonth: Infinity
      },
      promax: {
        aiImagesPerMonth: 200,
        aiVideosPerMonth: 10,
        aiTextPerMonth: Infinity
      }
    };
  }

  /**
   * 获取用户使用历史
   */
  static async getUsageHistory(db, userId, limit = 50) {
    return await db.getAiUsageLogs(userId, limit);
  }

  /**
   * 检查是否有足够配额
   */
  static async hasEnoughQuota(db, userId, type, amount = 1) {
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
          return { hasQuota: true };
      }

      const hasQuota = limit === Infinity || currentUsage + amount <= limit;
      return {
        hasQuota,
        current: currentUsage,
        limit,
        remaining: limit === Infinity ? Infinity : Math.max(0, limit - currentUsage),
        overage: limit === Infinity ? 0 : Math.max(0, currentUsage + amount - limit)
      };
    } catch (error) {
      return { hasQuota: false, error: error.message };
    }
  }

  /**
   * 记录使用并检查配额
   * 如果超过配额，计算额外费用
   */
  static async recordAndCheckQuota(db, userId, type, provider, model, amount, workflowId = null) {
    const quotaCheck = await this.hasEnoughQuota(db, userId, type, amount);
    
    if (!quotaCheck.hasQuota && quotaCheck.error) {
      return { success: false, error: quotaCheck.error };
    }

    const recordResult = await this.recordUsage(db, userId, type, provider, model, amount, workflowId);

    if (!recordResult.success) {
      return recordResult;
    }

    let overageCost = 0;
    if (!quotaCheck.hasQuota && quotaCheck.overage > 0) {
      overageCost = await this.calculateOverageCost(db, userId, type, quotaCheck.overage);
    }

    return {
      success: true,
      logId: recordResult.logId,
      quotaCheck,
      overageCost,
      pricing: this.getPricing()[type]
    };
  }
}

module.exports = { UsageMeter };
