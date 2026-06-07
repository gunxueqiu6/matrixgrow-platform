/**
 * Agent Actions - Action 执行器
 * 处理 Agent 返回的各种动作：publish, rewrite, query_stats, bind_platform, upgrade
 */

class AgentActions {
  constructor(options = {}) {
    this.db = options.db;
    this.textRewriter = options.textRewriter;
    this.apiPublisher = options.apiPublisher;
    this.rpaPublisher = options.rpaPublisher;
    this.artipubPublisher = options.artipubPublisher;
    this.llmAdapter = options.llmAdapter;
  }

  /**
   * 发布内容到指定平台
   */
  async publish(params, userId) {
    const { content, platforms } = params;

    if (!content) {
      return { success: false, error: '缺少内容参数' };
    }

    // 获取用户绑定的平台凭证
    const userPlatforms = await this.db.getUserPlatforms(userId, true);
    const boundPlatforms = new Set(userPlatforms.map(p => p.platform));

    // 过滤用户已绑定的平台
    const targetPlatforms = platforms?.filter(p => boundPlatforms.has(p)) || [];

    if (targetPlatforms.length === 0) {
      return { 
        success: false, 
        error: '没有找到已绑定的目标平台',
        availablePlatforms: [...boundPlatforms]
      };
    }

    const results = [];

    for (const platform of targetPlatforms) {
      try {
        // 获取平台凭证
        const userPlatform = userPlatforms.find(p => p.platform === platform);
        const credentials = userPlatform ? JSON.parse(userPlatform.credentials) : {};

        // 根据发布方式选择不同的发布器
        let result;
        const platformConfig = this.getPlatformConfig(platform);

        if (platformConfig.publishMethod === 'api') {
          result = await this.apiPublisher.publishToPlatform(platform, content, { credentials });
        } else if (platformConfig.publishMethod === 'artipub') {
          result = await this.artipubPublisher.publish(content, platform, { credentials });
        } else {
          result = await this.rpaPublisher.publishToPlatform(platform, content, { credentials });
        }

        results.push({
          platform,
          success: true,
          ...result
        });
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: true,
      action: 'publish',
      results
    };
  }

  /**
   * AI 文本改写
   */
  async rewrite(params) {
    const { content, style = 'social-media' } = params;

    if (!content) {
      return { success: false, error: '缺少内容参数' };
    }

    try {
      const result = await this.textRewriter.rewrite(content, style);
      
      return {
        success: true,
        action: 'rewrite',
        style,
        rewrittenContent: result.content
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 查询统计数据
   */
  async queryStats(params, userId) {
    const { period = 'this_month' } = params;

    try {
      const [overview, dailyStats, platformBreakdown] = await Promise.all([
        this.db.getAnalyticsOverview(userId),
        this.db.getDailyStats(period === 'this_month' ? 30 : 7, userId),
        this.db.getPlatformBreakdown(userId)
      ]);

      return {
        success: true,
        action: 'query_stats',
        period,
        data: {
          overview,
          daily: dailyStats,
          platforms: platformBreakdown
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 绑定平台指引
   */
  async bindPlatform(params) {
    const { platform, instructions } = params;

    // 获取平台配置
    const platformConfig = this.getPlatformConfig(platform);

    return {
      success: true,
      action: 'bind_platform',
      platform,
      name: platformConfig.name,
      credentialFields: platformConfig.credentialFields || [],
      instructions: platformConfig.instructions || platformConfig.credentialFields?.map(f => f.instructions).join('\n') || '请按照提示绑定平台'
    };
  }

  /**
   * 升级订阅指引
   */
  async upgrade(params) {
    const { tier } = params;

    const tiers = {
      pro: {
        name: 'Pro',
        price: 99,
        features: ['27+ 平台', '高级 AI', '全平台监控']
      },
      promax: {
        name: 'ProMax',
        price: 299,
        features: ['27+ 平台', '每平台 5 账号', '批量操作', '高级分析']
      }
    };

    const targetTier = tiers[tier] || tiers.pro;

    return {
      success: true,
      action: 'upgrade',
      tier,
      ...targetTier,
      nextStep: '请前往订阅页面完成支付'
    };
  }

  /**
   * 获取平台配置（简化版本，实际应该从 config/platforms.json 读取）
   */
  getPlatformConfig(platform) {
    const platformsConfig = require('../config/platforms.json');
    const { platforms } = platformsConfig;

    // 在所有渠道中查找
    return {
      ...platforms.api_channels[platform],
      ...platforms.artipub_channels[platform],
      ...platforms.rpa_channels[platform],
      publishMethod: platforms.api_channels[platform] ? 'api' : 
                     platforms.artipub_channels[platform] ? 'artipub' : 'rpa'
    };
  }

  /**
   * 执行动作
   */
  async execute(action, params, userId) {
    switch (action) {
      case 'publish':
        return this.publish(params, userId);
      case 'rewrite':
        return this.rewrite(params);
      case 'query_stats':
        return this.queryStats(params, userId);
      case 'bind_platform':
        return this.bindPlatform(params);
      case 'upgrade':
        return this.upgrade(params);
      default:
        return {
          success: false,
          error: `未知动作: ${action}`
        };
    }
  }
}

module.exports = { AgentActions };
