/**
 * Agent Handler - Agent 核心逻辑
 * 处理用户对话、构建上下文、调用 LLM、解析 action、分发执行
 */

const fs = require('fs').promises;
const path = require('path');

class AgentHandler {
  constructor(options = {}) {
    this.db = options.db;
    this.llmAdapter = options.llmAdapter;
    this.agentActions = options.agentActions;
    this.systemPrompt = null;
    this.conversations = new Map(); // sessionId -> { messages, lastActivity }
    this.maxHistory = 10; // 最大对话历史条数
  }

  /**
   * 加载系统提示词
   */
  async initialize() {
    try {
      const promptPath = path.join(__dirname, '../ai-agents/prompts/builtin-agent.md');
      this.systemPrompt = await fs.readFile(promptPath, 'utf8');
      console.log('✅ Agent 系统提示词已加载');
    } catch (error) {
      console.warn('⚠️ 无法加载系统提示词:', error.message);
      this.systemPrompt = this.getDefaultPrompt();
    }
  }

  /**
   * 默认系统提示词
   */
  getDefaultPrompt() {
    return `你是 MatrixGrow AI 助手，帮助用户管理内容分发。

可用动作：
1. publish - 发布内容到平台
2. rewrite - 改写内容
3. query_stats - 查询统计
4. bind_platform - 绑定平台
5. upgrade - 升级订阅

输出格式：
- 需要执行操作：{"type": "action", "action": "动作名", "params": {...}}
- 纯对话：{"type": "chat", "content": "回答内容"}

回复请用中文。`;
  }

  /**
   * 获取会话（创建或获取现有会话）
   */
  getSession(sessionId) {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        messages: [],
        lastActivity: Date.now()
      });
    }

    // 清理过期会话（超过 1 小时）
    this.cleanupExpiredSessions();

    return this.conversations.get(sessionId);
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expireTime = 3600000; // 1 小时

    for (const [sessionId, session] of this.conversations) {
      if (now - session.lastActivity > expireTime) {
        this.conversations.delete(sessionId);
      }
    }
  }

  /**
   * 构建用户上下文
   */
  async buildUserContext(userId) {
    const [subscription, platforms, settings] = await Promise.all([
      this.db.getSubscription(userId),
      this.db.getUserPlatforms(userId, true),
      this.db.getUserSettings(userId)
    ]);

    return {
      tier: subscription?.tier || 'free',
      platformLimit: subscription?.platform_limit || 3,
      platforms: platforms.map(p => ({
        platform: p.platform,
        accountName: p.account_name,
        isActive: p.is_active
      })),
      llmProvider: settings?.llm_provider || 'deepseek'
    };
  }

  /**
   * 构建 messages 数组
   */
  async buildMessages(userMessage, userId, sessionId) {
    const session = this.getSession(sessionId);
    const userContext = await this.buildUserContext(userId);

    // 构建系统提示词（包含用户上下文）
    const systemMessage = `
${this.systemPrompt}

用户信息：
- 订阅等级: ${userContext.tier}
- 可用平台数: ${userContext.platformLimit}
- 已绑定平台: ${userContext.platforms.map(p => p.platform).join(', ') || '无'}
- 默认模型: ${userContext.llmProvider}

请根据用户上下文提供个性化回复。
`.trim();

    // 构建消息数组
    const messages = [
      { role: 'system', content: systemMessage },
      ...session.messages.slice(-this.maxHistory),
      { role: 'user', content: userMessage }
    ];

    return messages;
  }

  /**
   * 解析 LLM 返回
   */
  parseResponse(response) {
    const content = response.content?.trim() || '';

    // 尝试解析 JSON
    try {
      const parsed = JSON.parse(content);
      if (parsed.type && (parsed.type === 'action' || parsed.type === 'chat')) {
        return parsed;
      }
    } catch {
      // 不是 JSON，当作普通文本
    }

    // 如果不是 JSON，返回 chat 类型
    return {
      type: 'chat',
      content
    };
  }

  /**
   * 处理用户消息
   */
  async handleMessage(userMessage, userId, sessionId = 'default') {
    try {
      // 获取用户 LLM 设置
      const settings = await this.db.getUserSettings(userId);
      const llmConfig = {
        provider: settings?.llm_provider || 'deepseek',
        apiKey: settings?.llm_api_key || process.env.DEEPSEEK_API_KEY,
        apiUrl: settings?.llm_api_url,
        model: settings?.llm_model
      };

      // 更新 LLM adapter 配置
      this.llmAdapter.updateConfig(llmConfig);

      // 构建消息
      const messages = await this.buildMessages(userMessage, userId, sessionId);

      // 调用 LLM
      const llmResponse = await this.llmAdapter.complete(messages, {
        maxTokens: 2048,
        temperature: 0.7
      });

      if (!llmResponse.success) {
        return {
          success: false,
          error: llmResponse.error || 'LLM 调用失败'
        };
      }

      // 解析响应
      const parsed = this.parseResponse(llmResponse);

      // 保存对话历史
      const session = this.getSession(sessionId);
      session.messages.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: llmResponse.content }
      );
      session.lastActivity = Date.now();

      // 处理 action
      if (parsed.type === 'action') {
        const actionResult = await this.agentActions.execute(
          parsed.action,
          parsed.params || {},
          userId
        );

        return {
          success: true,
          type: 'action',
          action: parsed.action,
          result: actionResult
        };
      }

      // 纯聊天
      return {
        success: true,
        type: 'chat',
        content: parsed.content
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清除会话历史
   */
  clearSession(sessionId) {
    this.conversations.delete(sessionId);
  }
}

module.exports = { AgentHandler };
