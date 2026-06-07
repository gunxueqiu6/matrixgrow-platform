/**
 * SaaS Routes - 订阅、平台绑定、设置相关 API
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { TierGuard } = require('../utils/tier-guard');
const { encryptCredentials, decryptCredentials } = require('../utils/credentials');
const platformsConfig = require('../config/platforms.json');

function createSaasRouter(db, agentHandler = null) {
  const router = express.Router();

  // ========== 订阅相关 ==========

  // GET /api/subscription - 获取当前订阅
  router.get('/subscription', authenticate, async (req, res) => {
    try {
      const subscription = await db.getSubscription(req.user.userId);
      const platformsUsed = await db.getUserPlatformsCount(req.user.userId);

      if (!subscription) {
        return res.json({
          tier: 'free',
          platformLimit: 3,
          accountsPerPlatform: 1,
          platformsUsed: 0,
          platformsAvailable: 3
        });
      }

      res.json({
        tier: subscription.tier,
        platformLimit: subscription.platform_limit,
        accountsPerPlatform: subscription.accounts_per_platform,
        startedAt: subscription.started_at,
        expiresAt: subscription.expires_at,
        platformsUsed,
        platformsAvailable: subscription.platform_limit - platformsUsed
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/subscription/upgrade - 升级订阅
  router.put('/subscription/upgrade', authenticate, async (req, res) => {
    try {
      const { tier } = req.body;

      if (!['free', 'pro', 'promax'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier' });
      }

      await db.updateSubscription(req.user.userId, tier);

      res.json({
        success: true,
        tier,
        message: `已升级到 ${tier} 版本`
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/subscription/tiers - 获取套餐对比
  router.get('/subscription/tiers', (req, res) => {
    res.json(TierGuard.getTierComparison());
  });

  // ========== 平台管理 ==========

  // GET /api/platforms - 获取所有平台定义
  router.get('/platforms', authenticate, async (req, res) => {
    try {
      const { platforms } = platformsConfig;

      // 合并所有渠道的平台
      const allPlatforms = {
        ...platforms.api_channels,
        ...platforms.artipub_channels,
        ...platforms.rpa_channels
      };

      // 格式化输出（移除敏感信息）
      const formattedPlatforms = Object.entries(allPlatforms).map(([key, platform]) => ({
        id: key,
        name: platform.name,
        category: platform.category,
        publishMethod: platform.publishMethod,
        credentialFields: platform.credentialFields || [],
        config: platform.config || {}
      }));

      // 按分类分组
      const grouped = {
        'api': formattedPlatforms.filter(p => p.publishMethod === 'api'),
        'artipub': formattedPlatforms.filter(p => p.publishMethod === 'artipub'),
        'rpa': formattedPlatforms.filter(p => p.publishMethod === 'rpa')
      };

      res.json({
        platforms: formattedPlatforms,
        grouped,
        total: formattedPlatforms.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/my-platforms - 获取用户已绑定的平台
  router.get('/my-platforms', authenticate, async (req, res) => {
    try {
      const platforms = await db.getUserPlatforms(req.user.userId);

      res.json({
        platforms: platforms.map(({ user_id, ...rest }) => rest),
        total: platforms.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/my-platforms - 绑定新平台
  router.post('/my-platforms', authenticate, async (req, res) => {
    try {
      const { platform, account_name, credentials } = req.body;

      if (!platform) {
        return res.status(400).json({ error: '缺少平台参数' });
      }

      if (!credentials || Object.keys(credentials).length === 0) {
        return res.status(400).json({ error: '缺少凭证信息' });
      }

      // Tier 检查
      const checkResult = await TierGuard.checkPlatformLimit(db, req.user.userId, platform);

      if (!checkResult.allowed) {
        return res.status(403).json({
          error: checkResult.reason,
          upgradeRequired: checkResult.upgradeRequired || false
        });
      }

      // 加密凭证
      const encryptedCredentials = encryptCredentials(credentials);

      // 存储
      const id = await db.createUserPlatform(
        req.user.userId,
        platform,
        encryptedCredentials,
        account_name || platform
      );

      res.status(201).json({
        success: true,
        id,
        platform,
        account_name: account_name || platform,
        message: '平台绑定成功'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/my-platforms/:id - 更新绑定账号
  router.put('/my-platforms/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { account_name, credentials } = req.body;

      // 检查所有权
      const platform = await db.getUserPlatformById(parseInt(id), req.user.userId);

      if (!platform) {
        return res.status(404).json({ error: '平台绑定不存在' });
      }

      const updates = {};

      if (account_name) {
        updates.account_name = account_name;
      }

      if (credentials && Object.keys(credentials).length > 0) {
        updates.credentials = encryptCredentials(credentials);
      }

      await db.updateUserPlatform(parseInt(id), req.user.userId, updates);

      res.json({
        success: true,
        message: '更新成功'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/my-platforms/:id - 解绑平台
  router.delete('/my-platforms/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      const changes = await db.deleteUserPlatform(parseInt(id), req.user.userId);

      if (changes === 0) {
        return res.status(404).json({ error: '平台绑定不存在' });
      }

      res.json({
        success: true,
        message: '解绑成功'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/my-platforms/:id/credentials - 获取解密后的凭证（需要特殊权限）
  router.get('/my-platforms/:id/credentials', authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      const platform = await db.getUserPlatformById(parseInt(id), req.user.userId);

      if (!platform) {
        return res.status(404).json({ error: '平台绑定不存在' });
      }

      // 解密凭证
      const credentials = decryptCredentials(platform.credentials);

      res.json({
        platform: platform.platform,
        account_name: platform.account_name,
        credentials
      });
    } catch (error) {
      res.status(500).json({ error: '凭证解密失败' });
    }
  });

  // ========== 设置相关 ==========

  // GET /api/settings - 获取用户设置
  router.get('/settings', authenticate, async (req, res) => {
    try {
      const settings = await db.getUserSettings(req.user.userId);

      if (!settings) {
        return res.json({
          llmProvider: 'deepseek',
          llmApiKey: '',
          llmApiUrl: '',
          llmModel: '',
          proxyEnabled: false,
          proxyUrl: ''
        });
      }

      // 不返回加密的 API key
      res.json({
        llmProvider: settings.llm_provider,
        llmApiKey: settings.llm_api_key ? '********' : '',
        llmApiUrl: settings.llm_api_url,
        llmModel: settings.llm_model,
        proxyEnabled: !!settings.proxy_enabled,
        proxyUrl: settings.proxy_url
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/settings - 更新用户设置
  router.put('/settings', authenticate, async (req, res) => {
    try {
      const { llm_provider, llm_api_key, llm_api_url, llm_model, proxy_enabled, proxy_url } = req.body;

      // 获取现有设置
      let existing = await db.getUserSettings(req.user.userId);

      // 如果没有设置，先创建
      if (!existing) {
        await db.createUserSettings(req.user.userId);
      }

      const updates = {};

      if (llm_provider !== undefined) updates.llm_provider = llm_provider;
      if (llm_api_url !== undefined) updates.llm_api_url = llm_api_url;
      if (llm_model !== undefined) updates.llm_model = llm_model;
      if (proxy_enabled !== undefined) updates.proxy_enabled = proxy_enabled ? 1 : 0;
      if (proxy_url !== undefined) updates.proxy_url = proxy_url;

      // 只有填写了新的 API key 才更新
      if (llm_api_key && llm_api_key !== '********') {
        updates.llm_api_key = llm_api_key;
      }

      await db.updateUserSettings(req.user.userId, updates);

      res.json({
        success: true,
        message: '设置已保存'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Agent 对话 ==========

  // POST /api/agent - AI Agent 对话入口
  router.post('/agent', authenticate, async (req, res) => {
    try {
      const { message, sessionId = 'default' } = req.body;

      if (!message) {
        return res.status(400).json({ error: '缺少消息内容' });
      }

      if (!agentHandler) {
        return res.json({
          success: true,
          type: 'chat',
          content: 'Agent 服务正在初始化中，请稍候重试。'
        });
      }

      // 调用 Agent Handler
      const result = await agentHandler.handleMessage(message, req.user.userId, sessionId);

      if (!result.success) {
        return res.json({
          success: true,
          type: 'chat',
          content: `抱歉，我遇到了一个问题：${result.error}。请稍后重试。`
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/agent/clear-session - 清除对话历史
  router.post('/agent/clear-session', authenticate, async (req, res) => {
    try {
      const { sessionId = 'default' } = req.body;
      if (agentHandler) {
        agentHandler.clearSession(sessionId);
      }
      res.json({ success: true, message: '对话历史已清除' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createSaasRouter };
