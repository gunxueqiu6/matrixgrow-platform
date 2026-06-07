/**
 * Text Rewriter - AI 文本改写管线
 * 根据目标平台调用对应的 LLM Agent 进行文案风格改写
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class TextRewriter {
  constructor(config = {}) {
    this.config = {
      anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      deepseekApiKey: config.deepseekApiKey || process.env.DEEPSEEK_API_KEY,
      promptsDir: config.promptsDir || path.join(__dirname, '../../ai-agents/prompts'),
      configPath: config.configPath || path.join(__dirname, '../../ai-agents/agent-config.json'),
      ...config
    };

    this.agentConfig = null;
    this.promptsCache = {};
  }

  /**
   * 初始化：加载 Agent 配置
   */
  async initialize() {
    try {
      const configData = await fs.readFile(this.config.configPath, 'utf-8');
      this.agentConfig = JSON.parse(configData);
      console.log('✅ Agent 配置已加载');
    } catch (error) {
      console.error('❌ 加载 Agent 配置失败:', error.message);
      throw error;
    }
  }

  /**
   * 加载指定 Agent 的 Prompt 模板
   */
  async loadPrompt(agentName) {
    if (this.promptsCache[agentName]) {
      return this.promptsCache[agentName];
    }

    const promptFile = path.join(this.config.promptsDir, `${agentName}.md`);
    try {
      const promptContent = await fs.readFile(promptFile, 'utf-8');
      this.promptsCache[agentName] = promptContent;
      return promptContent;
    } catch (error) {
      console.error(`❌ 加载 Prompt ${agentName} 失败:`, error.message);
      return this.getDefaultPrompt(agentName);
    }
  }

  /**
   * 默认 Prompt（备用）
   */
  getDefaultPrompt(agentName) {
    const defaults = {
      'tech-blog-agent': 'You are a technical blogger. Rewrite the content into a detailed tutorial-style article with code examples.',
      'social-media-agent': 'You are a social media content creator. Rewrite with emojis and emotional tone.',
      'hardcore-community-agent': 'You are a veteran developer. Rewrite as a casual technical discussion, no marketing.',
      'micro-blog-agent': 'You are an indie hacker on Twitter. Create a thread with hooks and hashtags.',
      'intercept-agent': 'You are a helpful indie developer. Respond with empathy, provide value, then softly mention your tool.'
    };
    return defaults[agentName] || 'Rewrite the content appropriately.';
  }

  /**
   * 根据平台选择对应的 Agent
   */
  getAgentForPlatform(platform) {
    const platformAgentMap = {
      // 技术博客
      'devto': 'tech-blog-agent',
      'medium': 'tech-blog-agent',
      'zhihu': 'tech-blog-agent',
      'jianshu': 'tech-blog-agent',
      // 硬核社区
      'v2ex': 'hardcore-community-agent',
      'reddit': 'hardcore-community-agent',
      'hackernews': 'hardcore-community-agent',
      // 社交媒体
      'xiaohongshu': 'social-media-agent',
      'instagram': 'social-media-agent',
      // 微博
      'x': 'micro-blog-agent',
      'twitter': 'micro-blog-agent',
      'threads': 'micro-blog-agent',
      'linkedin': 'micro-blog-agent'
    };

    return platformAgentMap[platform] || 'tech-blog-agent';
  }

  /**
   * 获取 Agent 的模型配置
   */
  getAgentModelConfig(agentName) {
    if (!this.agentConfig) {
      return { model: 'claude-3-5-sonnet', temperature: 0.7, max_tokens: 2000 };
    }

    const agentKey = agentName.replace('-agent', '').replace('-', '');
    const agentMap = {
      'techblog': 'techBlog',
      'hardcorecommunity': 'hardcoreCommunity',
      'socialmedia': 'socialMedia',
      'microblog': 'microBlog',
      'intercept': 'intercept'
    };

    const key = agentMap[agentKey.replace('-', '')] || 'techBlog';
    return this.agentConfig.agents[key] || this.agentConfig.agents.techBlog;
  }

  /**
   * 调用 Claude API
   */
  async callClaude(prompt, userContent, modelConfig) {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: modelConfig.model || 'claude-3-5-sonnet',
      max_tokens: modelConfig.max_tokens || 2000,
      temperature: modelConfig.temperature || 0.7,
      system: prompt,
      messages: [
        { role: 'user', content: userContent }
      ]
    }, {
      headers: {
        'x-api-key': this.config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    return response.data.content[0].text;
  }

  /**
   * 调用 OpenAI API
   */
  async callOpenAI(prompt, userContent, modelConfig) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: modelConfig.model || 'gpt-4o',
      max_tokens: modelConfig.max_tokens || 2000,
      temperature: modelConfig.temperature || 0.7,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userContent }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  }

  /**
   * 调用 DeepSeek API（用于意向度过滤等低成本任务）
   */
  async callDeepSeek(prompt, userContent, modelConfig) {
    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
    const response = await axios.post(`${apiUrl}/chat/completions`, {
      model: modelConfig.model || 'deepseek-chat',
      max_tokens: modelConfig.max_tokens || 1000,
      temperature: modelConfig.temperature || 0.5,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userContent }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.deepseekApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  }

  /**
   * 核心方法：改写内容
   * @param {string} originalText - 原始文本
   * @param {string|string[]} targetPlatforms - 目标平台
   * @returns {Object} - 各平台的改写结果
   */
  async rewrite(originalText, targetPlatforms) {
    if (!this.agentConfig) {
      await this.initialize();
    }

    // 处理 'all' 情况
    if (targetPlatforms === 'all' || (Array.isArray(targetPlatforms) && targetPlatforms.includes('all'))) {
      targetPlatforms = ['tech-blog', 'social-media', 'hardcore', 'micro-blog'];
    }

    if (!Array.isArray(targetPlatforms)) {
      targetPlatforms = [targetPlatforms];
    }

    const results = {};

    for (const platform of targetPlatforms) {
      try {
        const agentName = this.getAgentForPlatform(platform);
        const prompt = await this.loadPrompt(agentName);
        const modelConfig = this.getAgentModelConfig(agentName);

        console.log(`🔄 正在改写 [${platform}] 使用 Agent [${agentName}]...`);

        // 根据模型选择 API
        let rewrittenContent;
        if (modelConfig.model?.includes('claude')) {
          rewrittenContent = await this.callClaude(prompt, originalText, modelConfig);
        } else if (modelConfig.model?.includes('gpt')) {
          rewrittenContent = await this.callOpenAI(prompt, originalText, modelConfig);
        } else if (modelConfig.model?.includes('deepseek')) {
          rewrittenContent = await this.callDeepSeek(prompt, originalText, modelConfig);
        } else {
          // 默认用 Claude
          rewrittenContent = await this.callClaude(prompt, originalText, modelConfig);
        }

        results[platform] = {
          success: true,
          agent: agentName,
          model: modelConfig.model,
          content: rewrittenContent,
          originalLength: originalText.length,
          rewrittenLength: rewrittenContent.length
        };

        console.log(`✅ [${platform}] 改写完成 (${rewrittenContent.length} 字)`);
      } catch (error) {
        console.error(`❌ [${platform}] 改写失败:`, error.message);
        results[platform] = {
          success: false,
          error: error.message,
          content: originalText // 失败时返回原文
        };
      }
    }

    return results;
  }

  /**
   * 截流专用：生成回复内容
   */
  async generateInterceptReply(postContent, platform) {
    if (!this.agentConfig) {
      await this.initialize();
    }

    const prompt = await this.loadPrompt('intercept-agent');
    const modelConfig = this.agentConfig.agents.intercept;

    const userPrompt = `Post content: ${postContent}\nPost platform: ${platform}\n\nGenerate a response following the three-step intercept method.`;

    try {
      let reply;
      if (modelConfig.model?.includes('claude')) {
        reply = await this.callClaude(prompt, userPrompt, modelConfig);
      } else {
        reply = await this.callOpenAI(prompt, userPrompt, modelConfig);
      }

      return {
        success: true,
        content: reply,
        platform
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { TextRewriter };