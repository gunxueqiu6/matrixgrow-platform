/**
 * Webhook Routes - Webhook CRUD API
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');

function createWebhookRouter(db, webhookDispatcher) {
  const router = express.Router();

  // GET /api/webhooks - 获取用户的 webhook 列表
  router.get('/webhooks', authenticate, async (req, res) => {
    try {
      const webhooks = await db.getUserWebhooks(req.user.userId);
      res.json({ success: true, webhooks });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/webhooks - 创建 webhook
  router.post('/webhooks', authenticate, async (req, res) => {
    try {
      const { name, url, events, secret } = req.body;

      if (!url || !events || !Array.isArray(events)) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const id = await db.createWebhook(req.user.userId, name || 'Webhook', url, events, secret);

      res.status(201).json({
        success: true,
        id,
        message: 'Webhook 创建成功'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/webhooks/:id - 更新 webhook
  router.put('/webhooks/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, url, events, secret, is_active } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (url !== undefined) updates.url = url;
      if (events !== undefined) updates.events = events;
      if (secret !== undefined) updates.secret = secret;
      if (is_active !== undefined) updates.is_active = is_active ? 1 : 0;

      const changes = await db.updateWebhook(parseInt(id), req.user.userId, updates);

      if (changes === 0) {
        return res.status(404).json({ error: 'Webhook 不存在' });
      }

      res.json({ success: true, message: 'Webhook 更新成功' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/webhooks/:id - 删除 webhook
  router.delete('/webhooks/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const changes = await db.deleteWebhook(parseInt(id), req.user.userId);

      if (changes === 0) {
        return res.status(404).json({ error: 'Webhook 不存在' });
      }

      res.json({ success: true, message: 'Webhook 删除成功' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/webhooks/:id/logs - 查看 webhook 发送日志
  router.get('/webhooks/:id/logs', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 50 } = req.query;

      // 验证所有权
      const webhook = await db.getWebhookById(parseInt(id), req.user.userId);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook 不存在' });
      }

      const logs = await db.getWebhookLogs(parseInt(id), parseInt(limit));
      res.json({ success: true, logs });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/webhooks/:id/test - 发送测试事件
  router.post('/webhooks/:id/test', authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      if (!webhookDispatcher) {
        return res.status(500).json({ error: 'Webhook dispatcher 未初始化' });
      }

      const result = await webhookDispatcher.sendTestEvent(parseInt(id), req.user.userId);

      if (!result.success) {
        return res.json({
          success: false,
          error: result.error || '测试发送失败'
        });
      }

      res.json({ success: true, message: '测试消息已发送' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createWebhookRouter };
