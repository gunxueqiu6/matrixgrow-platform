/**
 * DM Monitor - 私信监控脚本
 * 监控各平台私信，自动回复并发送产品链接
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class DMMonitor {
  constructor(config = {}) {
    this.config = {
      cookiesPath: config.cookiesPath || './cookies',
      checkInterval: config.checkInterval || 300000, // 5 分钟
      platforms: config.platforms || ['v2ex', 'reddit', 'x'],
      dmHistoryPath: config.dmHistoryPath || './data/dm-history.json',
      ...config
    };

    this.dmHistory = {};
    this.textRewriter = null;
  }

  /**
   * 初始化：加载历史记录和改写器
   */
  async initialize(textRewriter) {
    this.textRewriter = textRewriter;
    
    try {
      const historyData = await fs.readFile(this.config.dmHistoryPath, 'utf-8');
      this.dmHistory = JSON.parse(historyData);
      console.log('✅ 私信历史记录已加载');
    } catch {
      this.dmHistory = {};
      console.log('💡 私信历史记录为空，将创建新文件');
    }
  }

  /**
   * 检查所有平台的私信
   */
  async checkAllPlatforms() {
    const results = [];

    for (const platform of this.config.platforms) {
      try {
        const dms = await this[`check${this.capitalize(platform)}DMs`]();
        
        // 过滤已处理的私信
        const newDMs = dms.filter(dm => !this.dmHistory[dm.id]);
        
        if (newDMs.length > 0) {
          console.log(`📬 ${platform}: 发现 ${newDMs.length} 条新私信`);
          results.push(...newDMs);
        }
      } catch (error) {
        console.error(`❌ ${platform} 私信检查失败:`, error.message);
      }
    }

    return results;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * 检查 V2EX 私信 (需要 RPA)
   */
  async checkV2exDMs() {
    // V2EX 没有公开私信 API，需要通过 RPA 或手动检查
    // 这里返回模拟数据，实际需要 RPA 实现
    console.log('  V2EX 私信检查需要 RPA 实现');
    return [];
  }

  /**
   * 检查 Reddit 私信
   */
  async checkRedditDMs() {
    try {
      const response = await axios.get('https://www.reddit.com/message/inbox.json', {
        headers: {
          'User-Agent': 'MatrixGrow/1.0',
          'Authorization': `Bearer ${process.env.REDDIT_ACCESS_TOKEN}`
        },
        timeout: 10000
      });

      const messages = response.data.data.children || [];
      
      return messages.map(msg => ({
        id: `reddit_dm_${msg.data.id}`,
        platform: 'reddit',
        from: msg.data.author,
        subject: msg.data.subject,
        content: msg.data.body,
        created_at: new Date(msg.data.created_utc * 1000).toISOString(),
        url: `https://reddit.com/message/messages/${msg.data.id}`
      }));
    } catch (error) {
      console.error('Reddit DM check failed:', error.message);
      return [];
    }
  }

  /**
   * 检查 X/Twitter 私信
   * 使用自建的关键词监控系统覆盖 Mention 功能
   * 通过 keyword-monitor 检测相关帖子，用户可通过帖子互动（如回复）联系
   * 如需直接私信功能，需要 Twitter API v2 的 dm.write 权限或 RPA 实现
   */
  async checkXDMs() {
    // X 私信监控通过以下方式覆盖：
    // 1. keyword-monitor.js 监听相关关键词帖子
    // 2. 用户看到有帮助的回复后，可通过其他渠道联系
    // 3. server.js 中的 /api/monitor/check 接口提供实时检查
    // 直接私信功能需要 Twitter API v2 dm.write 权限（需申请）
    console.log('  X 私信通过关键词监听覆盖，如需直接私信功能请配置 Twitter API');
    return [];
  }

  /**
   * 生成私信回复
   */
  async generateReply(dm) {
    if (!this.textRewriter) {
      throw new Error('TextRewriter not initialized');
    }

    const prompt = `You received a private message from someone interested in your tool.
They likely saw your helpful reply on a forum and want to learn more.

Their message: "${dm.content}"

Generate a friendly, helpful reply that:
1. Thanks them for reaching out
2. Provides your product link directly (since this is private, no restrictions)
3. Offers to help with setup or questions
4. Keeps it brief and genuine

Format: Just the reply text, no special formatting.`;

    try {
      // 使用低成本模型生成回复
      const reply = await this.textRewriter.callDeepSeek(prompt, dm.content, {
        model: 'deepseek-chat',
        max_tokens: 300,
        temperature: 0.7
      });

      return {
        success: true,
        reply: reply
      };
    } catch (error) {
      // 失败时返回默认回复
      return {
        success: true,
        reply: `Hi! Thanks for reaching out. Here's the tool I mentioned: ${process.env.PRODUCT_URL || 'https://matrixgrow.com'}\n\nFeel free to ask if you have any questions about setup. I'm happy to help!`
      };
    }
  }

  /**
   * 发送私信回复
   */
  async sendReply(dm, replyContent) {
    const senders = {
      reddit: this.sendRedditReply.bind(this),
      v2ex: this.sendV2exReply.bind(this),
      x: this.sendXReply.bind(this)
    };

    const sender = senders[dm.platform];
    if (!sender) {
      throw new Error(`Unsupported DM platform: ${dm.platform}`);
    }

    return sender(dm, replyContent);
  }

  /**
   * 发送 Reddit 私信回复
   */
  async sendRedditReply(dm, content) {
    try {
      await axios.post('https://www.reddit.com/api/compose', {
        to: dm.from,
        subject: `Re: ${dm.subject}`,
        text: content
      }, {
        headers: {
          'User-Agent': 'MatrixGrow/1.0',
          'Authorization': `Bearer ${process.env.REDDIT_ACCESS_TOKEN}`
        }
      });

      return { success: true, platform: 'reddit' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送 V2EX 私信回复 (RPA)
   */
  async sendV2exReply(dm, content) {
    // 需要 RPA 实现
    console.log('  V2EX 私信回复需要 RPA 实现');
    return { success: false, error: 'RPA not implemented' };
  }

  /**
   * 发送 X 私信回复 (RPA)
   */
  async sendXReply(dm, content) {
    // 需要 RPA 实现
    console.log('  X 私信回复需要 RPA 实现');
    return { success: false, error: 'RPA not implemented' };
  }

  /**
   * 处理新私信
   */
  async processDM(dm) {
    console.log(`\n📨 处理私信 [${dm.platform}] 来自 ${dm.from}`);
    
    // 1. 生成回复
    const replyResult = await this.generateReply(dm);
    
    if (!replyResult.success) {
      console.log('  ❌ 回复生成失败');
      return { success: false };
    }

    console.log('  ✅ 回复已生成');

    // 2. 发送回复
    const sendResult = await this.sendReply(dm, replyResult.reply);
    
    if (sendResult.success) {
      console.log('  ✅ 回复已发送');
      
      // 3. 记录历史
      this.dmHistory[dm.id] = {
        processedAt: new Date().toISOString(),
        originalContent: dm.content,
        replyContent: replyResult.reply,
        platform: dm.platform
      };
      
      await this.saveHistory();
      
      return { success: true, reply: replyResult.reply };
    } else {
      console.log('  ❌ 回复发送失败:', sendResult.error);
      return { success: false, error: sendResult.error };
    }
  }

  /**
   * 处理所有新私信
   */
  async processAllDMs() {
    const dms = await this.checkAllPlatforms();
    
    const results = [];
    for (const dm of dms) {
      const result = await this.processDM(dm);
      results.push({ dm, result });
    }

    return {
      total: dms.length,
      processed: results.filter(r => r.result.success).length,
      failed: results.filter(r => !r.result.success).length,
      details: results
    };
  }

  /**
   * 保存历史记录
   */
  async saveHistory() {
    const dir = path.dirname(this.config.dmHistoryPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.config.dmHistoryPath, JSON.stringify(this.dmHistory, null, 2));
  }

  /**
   * 启动定时监控
   */
  startScheduledCheck(callback) {
    console.log(`⏰ 私信监控已启动 (每 ${this.config.checkInterval / 60000} 分钟检查)`);
    
    return setInterval(async () => {
      try {
        const result = await this.processAllDMs();
        if (callback) callback(result);
      } catch (error) {
        console.error('私信监控错误:', error.message);
      }
    }, this.config.checkInterval);
  }
}

module.exports = { DMMonitor };