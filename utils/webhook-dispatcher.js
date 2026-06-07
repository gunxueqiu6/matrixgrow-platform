/**
 * Webhook Dispatcher - Webhook 投递引擎
 * 处理事件触发、并发投递、重试机制、日志记录
 */

const axios = require('axios');
const crypto = require('crypto');

class WebhookDispatcher {
  constructor(options = {}) {
    this.db = options.db;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelays = options.retryDelays || [1000, 5000, 15000]; // 1s, 5s, 15s
    this.timeout = options.timeout || 10000; // 10s
    this.concurrency = options.concurrency || 5;
  }

  /**
   * 计算 HMAC 签名
   */
  signPayload(payload, secret) {
    if (!secret) return null;
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * 发送单个 webhook
   */
  async sendWebhook(webhook, event, payload) {
    const { id, url, secret } = webhook;
    const headers = {
      'Content-Type': 'application/json',
      'X-MatrixGrow-Event': event,
      'X-MatrixGrow-Delivery': crypto.randomUUID()
    };

    // 添加签名
    const signature = this.signPayload(payload, secret);
    if (signature) {
      headers['X-MatrixGrow-Signature'] = `sha256=${signature}`;
    }

    try {
      const response = await axios.post(url, payload, {
        headers,
        timeout: this.timeout
      });

      return {
        success: true,
        status: response.status,
        body: response.data ? JSON.stringify(response.data) : null
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || null,
        error: error.message,
        body: error.response?.data ? JSON.stringify(error.response.data) : null
      };
    }
  }

  /**
   * 重试发送
   */
  async sendWithRetry(webhook, event, payload, retryCount = 0) {
    const result = await this.sendWebhook(webhook, event, payload);

    if (result.success) {
      return result;
    }

    // 记录失败日志
    await this.db.createWebhookLog(
      webhook.id,
      event,
      'failed',
      result.status,
      result.body,
      result.error
    );

    // 更新失败次数
    await this.db.updateWebhook(webhook.id, webhook.user_id, {
      failed_count: webhook.failed_count + 1
    });

    // 重试
    if (retryCount < this.maxRetries) {
      const delay = this.retryDelays[retryCount];
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.sendWithRetry(webhook, event, payload, retryCount + 1);
    }

    return result;
  }

  /**
   * 分发事件到所有订阅的 webhook
   */
  async dispatch(event, payload) {
    try {
      // 获取所有订阅该事件的活跃 webhook
      const webhooks = await this.db.getActiveWebhooksForEvent(event);

      if (webhooks.length === 0) {
        return { dispatched: 0, succeeded: 0, failed: 0 };
      }

      // 并发发送
      const results = await Promise.all(
        webhooks.map(webhook => this.sendWithRetry(webhook, event, payload))
      );

      // 更新成功的 webhook 的 last_sent_at
      const successfulIds = webhooks
        .filter((_, index) => results[index].success)
        .map(w => w.id);

      for (const id of successfulIds) {
        await this.db.updateWebhook(id, null, { last_sent_at: new Date().toISOString() });
        await this.db.createWebhookLog(id, event, 'success', 200, null, null);
      }

      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        dispatched: webhooks.length,
        succeeded,
        failed
      };
    } catch (error) {
      console.error('Webhook dispatch error:', error);
      return { dispatched: 0, succeeded: 0, failed: 0, error: error.message };
    }
  }

  /**
   * 发布完成事件
   */
  async publishCompleted(platform, url, title) {
    return this.dispatch('publish.completed', {
      event: 'publish.completed',
      platform,
      url,
      title,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 发布失败事件
   */
  async publishFailed(platform, error, title) {
    return this.dispatch('publish.failed', {
      event: 'publish.failed',
      platform,
      error,
      title,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 截流命中事件
   */
  async interceptMatched(platform, postUrl, intent, reply) {
    return this.dispatch('intercept.matched', {
      event: 'intercept.matched',
      platform,
      post_url: postUrl,
      intent,
      reply,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Agent 消息事件
   */
  async agentMessage(message, actions) {
    return this.dispatch('agent.message', {
      event: 'agent.message',
      message,
      actions,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 发送测试事件
   */
  async sendTestEvent(webhookId, userId) {
    const webhook = await this.db.getWebhookById(webhookId, userId);
    if (!webhook) return { success: false, error: 'Webhook not found' };

    const testPayload = {
      event: 'test',
      message: '这是一条测试消息',
      timestamp: new Date().toISOString()
    };

    const result = await this.sendWebhook(webhook, 'test', testPayload);

    await this.db.createWebhookLog(
      webhookId,
      'test',
      result.success ? 'success' : 'failed',
      result.status,
      result.body,
      result.error
    );

    return result;
  }
}

module.exports = { WebhookDispatcher };
