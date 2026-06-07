/**
 * LLM Adapter - 多模型统一调用接口
 * 支持 Claude / DeepSeek / OpenAI / Qwen
 */

const axios = require('axios');

class LLMAdapter {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'deepseek',
      apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY,
      apiUrl: config.apiUrl || 'https://api.deepseek.com/v1',
      model: config.model || 'deepseek-chat',
      ...config
    };

    this.providers = {
      claude: {
        name: 'Claude',
        apiUrl: 'https://api.anthropic.com/v1/messages',
        defaultModel: 'claude-3-5-sonnet-20241022',
        headers: (apiKey) => ({
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }),
        bodyBuilder: (messages, options) => ({
          model: options.model || 'claude-3-5-sonnet-20241022',
          max_tokens: options.maxTokens || 4096,
          messages: messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : m.role,
            content: m.content
          })),
          temperature: options.temperature || 0.7,
          system: options.system
        }),
        responseExtractor: (response) => response.data.content[0].text
      },
      deepseek: {
        name: 'DeepSeek',
        apiUrl: 'https://api.deepseek.com/chat/completions',
        defaultModel: 'deepseek-chat',
        headers: (apiKey) => ({
          'Authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json'
        }),
        bodyBuilder: (messages, options) => ({
          model: options.model || 'deepseek-chat',
          messages: messages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7
        }),
        responseExtractor: (response) => response.data.choices[0].message.content
      },
      openai: {
        name: 'OpenAI',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4o',
        headers: (apiKey) => ({
          'Authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json'
        }),
        bodyBuilder: (messages, options) => ({
          model: options.model || 'gpt-4o',
          messages: messages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7
        }),
        responseExtractor: (response) => response.data.choices[0].message.content
      },
      qwen: {
        name: 'Qwen',
        apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        defaultModel: 'qwen-plus',
        headers: (apiKey) => ({
          'Authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json'
        }),
        bodyBuilder: (messages, options) => ({
          model: options.model || 'qwen-plus',
          messages: messages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7
        }),
        responseExtractor: (response) => response.data.choices[0].message.content
      }
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * 统一调用接口
   */
  async complete(messages, options = {}) {
    const provider = this.providers[this.config.provider];

    if (!provider) {
      throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }

    const apiKey = options.apiKey || this.config.apiKey;
    const apiUrl = options.apiUrl || this.config.apiUrl || provider.apiUrl;

    if (!apiKey) {
      throw new Error(`API key not configured for ${provider.name}`);
    }

    try {
      const response = await axios.post(apiUrl, provider.bodyBuilder(messages, {
        ...this.config,
        ...options
      }), {
        headers: provider.headers(apiKey),
        timeout: options.timeout || 60000
      });

      return {
        success: true,
        content: provider.responseExtractor(response),
        provider: this.config.provider,
        model: options.model || this.config.model
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        provider: this.config.provider
      };
    }
  }

  /**
   * 快捷方法：文本改写
   */
  async rewrite(text, style, options = {}) {
    const systemPrompts = {
      'tech-blog': '你是一个技术博客作家，擅长写详细的长文教程。',
      'social-media': '你是一个社交媒体内容创作者，擅长写情绪化的短内容。',
      'hardcore': '你是一个资深开发者，在社区分享真实技术经验。',
      'micro-blog': '你是一个独立开发者，用简短有力的文字分享。'
    };

    const messages = [
      { role: 'system', content: systemPrompts[style] || systemPrompts['tech-blog'] },
      { role: 'user', content: `请将以下内容改写成适合${style}风格的版本：\n\n${text}` }
    ];

    return this.complete(messages, options);
  }

  /**
   * 快捷方法：意向度判断
   */
  async classifyIntent(text, options = {}) {
    const messages = [
      { role: 'system', content: '你是一个意向度分析专家，判断用户是否可能对你的产品感兴趣。回复格式：HIGH/MEDIUM/LOW 并简单说明理由。' },
      { role: 'user', content: `分析以下内容的意向度：\n\n${text}` }
    ];

    return this.complete(messages, options);
  }

  /**
   * 快捷方法：生成截流回复
   */
  async generateReply(postContent, platform, options = {}) {
    const platformContext = {
      v2ex: 'V2EX 是一个程序员社区，用户喜欢直接、有深度的讨论。',
      reddit: 'Reddit 是一个全球社区，用户喜欢真实分享。',
      zhihu: '知乎用户喜欢专业、有见地的回答。',
      xiaohongshu: '小红书用户喜欢真实体验分享。'
    };

    const messages = [
      { role: 'system', content: `你是 MatrixGrow 的 AI 助手，${platformContext[platform] || '帮助独立开发者获取用户。'}使用三段式回复：1）共情痛点，2）提供价值，3）软引导。不要发链接，不要过度营销。` },
      { role: 'user', content: `根据以下帖子内容，生成一条有价值的回复：\n\n${postContent}` }
    ];

    return this.complete(messages, options);
  }

  /**
   * 获取支持的提供商列表
   */
  static getSupportedProviders() {
    return ['claude', 'deepseek', 'openai', 'qwen'];
  }

  /**
   * 获取提供商配置模板
   */
  static getProviderTemplate(provider) {
    const templates = {
      claude: {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-5-sonnet-20241022',
        fields: ['apiKey']
      },
      deepseek: {
        apiUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        fields: ['apiKey']
      },
      openai: {
        apiUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        fields: ['apiKey']
      },
      qwen: {
        apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        model: 'qwen-plus',
        fields: ['apiKey']
      }
    };

    return templates[provider] || null;
  }
}

module.exports = { LLMAdapter };
