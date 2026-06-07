/**
 * Proxy Relay - VPS HTTP 转发代理
 * 用于国内用户通过 VPS 访问海外平台
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

class ProxyRelay {
  constructor(config = {}) {
    this.config = {
      port: config.port || 3001,
      token: config.token || process.env.PROXY_TOKEN || crypto.randomBytes(32).toString('hex'),
      allowedHosts: config.allowedHosts || [
        'api.twitter.com',
        'api.github.com',
        'openai.com',
        'api.anthropic.com',
        'discord.com',
        'slack.com'
      ],
      timeout: config.timeout || 30000,
      rateLimit: config.rateLimit || 100, // 每分钟请求数
      ...config
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // 请求日志
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });

    // JSON body parser
    this.app.use(express.json({ limit: '10mb' }));

    // 认证中间件
    this.app.use((req, res, next) => {
      const authToken = req.headers['x-proxy-token'] || req.query.token;

      if (authToken !== this.config.token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      next();
    });

    // 速率限制（简单实现）
    const requestCounts = new Map();

    this.app.use((req, res, next) => {
      const ip = req.ip;
      const now = Date.now();
      const windowMs = 60000; // 1 分钟

      if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      } else {
        const record = requestCounts.get(ip);

        if (now > record.resetAt) {
          record.count = 1;
          record.resetAt = now + windowMs;
        } else {
          record.count++;

          if (record.count > this.config.rateLimit) {
            return res.status(429).json({
              error: 'Rate limit exceeded',
              retryAfter: Math.ceil((record.resetAt - now) / 1000)
            });
          }
        }
      }

      next();
    });
  }

  setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        token: this.config.token
      });
    });

    // HTTP 转发
    this.app.all('/proxy/*', async (req, res) => {
      try {
        // 提取目标 URL
        const targetPath = req.path.replace('/proxy/', '');
        const targetUrl = `https://${targetPath}`;

        // 验证目标主机
        const url = new URL(targetUrl);
        const isAllowed = this.config.allowedHosts.some(host =>
          url.hostname === host || url.hostname.endsWith(`.${host}`)
        );

        if (!isAllowed) {
          return res.status(403).json({
            error: 'Host not allowed',
            allowedHosts: this.config.allowedHosts
          });
        }

        // 构建请求配置
        const config = {
          method: req.method,
          url: targetUrl,
          headers: {
            ...req.headers,
            host: url.hostname,
            'x-forwarded-for': req.ip,
            'x-proxy-token': undefined
          },
          params: req.query,
          data: req.body,
          timeout: this.config.timeout,
          responseType: 'stream',
          validateStatus: () => true
        };

        // 移除代理相关头
        delete config.headers.host;
        delete config.headers['content-length'];

        // 发起请求
        const response = await axios(config);

        // 转发响应
        res.status(response.status);
        Object.entries(response.headers).forEach(([key, value]) => {
          if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
          }
        });

        response.data.pipe(res);
      } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({
          error: 'Proxy request failed',
          message: error.message
        });
      }
    });

    // 错误处理
    this.app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * 启动代理服务
   */
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        console.log(`🔄 Proxy relay listening on port ${this.config.port}`);
        console.log(`🔑 Proxy token: ${this.config.token}`);
        console.log(`🌐 Allowed hosts: ${this.config.allowedHosts.join(', ')}`);
        resolve(this.server);
      });
    });
  }

  /**
   * 停止代理服务
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('✅ Proxy relay stopped');
          resolve();
        });
      });
    }
  }

  /**
   * 获取代理 URL
   */
  getProxyUrl(path = '') {
    return `http://localhost:${this.config.port}/proxy/${path}`;
  }

  /**
   * 获取代理配置（用于客户端）
   */
  getClientConfig() {
    return {
      enabled: true,
      baseUrl: `http://localhost:${this.config.port}/proxy`,
      token: this.config.token
    };
  }
}

// 独立运行
if (require.main === module) {
  const relay = new ProxyRelay();
  relay.start().catch(console.error);

  process.on('SIGINT', async () => {
    console.log('\nStopping proxy...');
    await relay.stop();
    process.exit(0);
  });
}

module.exports = { ProxyRelay };
