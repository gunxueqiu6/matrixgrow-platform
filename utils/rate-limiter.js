/**
 * Rate Limiter - 速率限制器
 * 防止被平台判定为 spam
 */

class RateLimiter {
  constructor(config = {}) {
    this.config = {
      defaultRate: config.defaultRate || 1, // 默认每秒请求数
      defaultBurst: config.defaultBurst || 5, // 默认突发量
      rates: config.rates || {
        v2ex: { rate: 0.5, burst: 2 },       // 30秒一次
        reddit: { rate: 1, burst: 3 },       // 每秒1次
        x: { rate: 2, burst: 5 },            // 每秒2次
        xiaohongshu: { rate: 0.33, burst: 1 }, // 3分钟一次
        zhihu: { rate: 0.5, burst: 2 },      // 30秒一次
        devto: { rate: 0.2, burst: 1 },      // 5分钟一次
        medium: { rate: 0.1, burst: 1 }      // 10分钟一次
      },
      ...config
    };

    this.queues = {};
    this.lastRequest = {};
    this.tokens = {};

    // 初始化每个平台的状态
    Object.keys(this.config.rates).forEach(platform => {
      this.resetPlatform(platform);
    });
  }

  resetPlatform(platform) {
    const config = this.config.rates[platform] || { rate: this.config.defaultRate, burst: this.config.defaultBurst };
    this.tokens[platform] = config.burst;
    this.lastRequest[platform] = Date.now();
    this.queues[platform] = [];
  }

  getPlatformConfig(platform) {
    return this.config.rates[platform] || { rate: this.config.defaultRate, burst: this.config.defaultBurst };
  }

  /**
   * 更新令牌桶
   */
  updateTokens(platform) {
    const now = Date.now();
    const config = this.getPlatformConfig(platform);
    const elapsed = (now - this.lastRequest[platform]) / 1000;
    
    // 计算新增令牌数
    const tokensToAdd = elapsed * config.rate;
    this.tokens[platform] = Math.min(this.tokens[platform] + tokensToAdd, config.burst);
    this.lastRequest[platform] = now;
  }

  /**
   * 检查是否允许请求
   */
  tryAcquire(platform) {
    this.updateTokens(platform);
    
    if (this.tokens[platform] >= 1) {
      this.tokens[platform] -= 1;
      return { allowed: true, waitTime: 0 };
    }

    return { allowed: false, waitTime: this.getWaitTime(platform) };
  }

  /**
   * 获取等待时间（毫秒）
   */
  getWaitTime(platform) {
    const config = this.getPlatformConfig(platform);
    const tokensNeeded = 1 - this.tokens[platform];
    return Math.ceil((tokensNeeded / config.rate) * 1000);
  }

  /**
   * 等待直到可以请求
   */
  async waitUntilAvailable(platform) {
    const result = this.tryAcquire(platform);
    
    if (result.allowed) {
      return true;
    }

    await this.delay(result.waitTime);
    return this.waitUntilAvailable(platform);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 添加到队列
   */
  enqueue(platform, task) {
    return new Promise((resolve) => {
      const queueItem = {
        task,
        resolve,
        timestamp: Date.now()
      };
      
      this.queues[platform].push(queueItem);
      this.processQueue(platform);
    });
  }

  /**
   * 处理队列
   */
  async processQueue(platform) {
    while (this.queues[platform].length > 0) {
      const result = this.tryAcquire(platform);
      
      if (result.allowed) {
        const item = this.queues[platform].shift();
        item.resolve();
      } else {
        await this.delay(result.waitTime);
      }
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(platform) {
    this.updateTokens(platform);
    const config = this.getPlatformConfig(platform);
    
    return {
      platform,
      tokens: this.tokens[platform],
      maxTokens: config.burst,
      rate: config.rate,
      queueLength: this.queues[platform].length
    };
  }

  /**
   * 获取所有平台状态
   */
  getAllStatus() {
    return Object.keys(this.config.rates).reduce((acc, platform) => {
      acc[platform] = this.getStatus(platform);
      return acc;
    }, {});
  }
}

/**
 * Publishing Queue - 发布队列管理器
 */

class PublishingQueue {
  constructor(config = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 3,
      rateLimiter: config.rateLimiter || new RateLimiter(),
      logger: config.logger,
      ...config
    };

    this.queue = [];
    this.runningCount = 0;
    this.processing = false;
  }

  /**
   * 添加任务到队列
   */
  add(task) {
    const queueItem = {
      ...task,
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      status: 'queued',
      createdAt: Date.now(),
      attempts: 0
    };

    this.queue.push(queueItem);
    
    if (this.logger) {
      this.logger.info(`Task queued: ${task.platform} - ${task.type}`);
    }

    this.process();
    return queueItem;
  }

  /**
   * 处理队列
   */
  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.runningCount < this.config.maxConcurrent) {
      const item = this.queue.shift();
      await this.execute(item);
    }

    this.processing = false;
  }

  /**
   * 执行任务
   */
  async execute(item) {
    this.runningCount++;
    item.status = 'running';

    if (this.logger) {
      this.logger.info(`Executing task: ${item.platform} - ${item.type}`);
    }

    try {
      // 速率限制检查
      await this.config.rateLimiter.waitUntilAvailable(item.platform);

      // 执行任务
      if (typeof item.handler === 'function') {
        const result = await item.handler();
        item.result = result;
        item.status = 'completed';
        
        if (this.logger) {
          this.logger.info(`Task completed: ${item.platform}`);
        }
      } else {
        item.status = 'completed';
      }
    } catch (error) {
      item.status = 'failed';
      item.error = error.message;
      item.attempts++;

      if (this.logger) {
        this.logger.error(`Task failed: ${item.platform} - ${error.message}`);
      }

      // 重试逻辑
      if (item.attempts < (item.maxRetries || 3)) {
        const delay = Math.pow(2, item.attempts) * 1000;
        setTimeout(() => {
          this.queue.push(item);
          this.process();
        }, delay);
      }
    } finally {
      this.runningCount--;
      this.process();
    }

    return item;
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queued: this.queue.filter(i => i.status === 'queued').length,
      running: this.queue.filter(i => i.status === 'running').length + this.runningCount,
      completed: this.queue.filter(i => i.status === 'completed').length,
      failed: this.queue.filter(i => i.status === 'failed' && i.attempts >= (i.maxRetries || 3)).length,
      rateLimits: this.config.rateLimiter.getAllStatus()
    };
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue = [];
    this.runningCount = 0;
  }
}

module.exports = { RateLimiter, PublishingQueue };