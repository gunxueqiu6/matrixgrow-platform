/**
 * Workflow Routes - 工作流和模板商店相关 API
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { TierGuard } = require('../utils/tier-guard');
const { UsageMeter } = require('../utils/usage-meter');

function createWorkflowsRouter(db) {
  const router = express.Router();

  // ========== 工作流模板商店 ==========

  // GET /api/workflows/templates - 获取模板列表
  router.get('/templates', authenticate, async (req, res) => {
    try {
      const { category, free_only, limit = 20 } = req.query;

      const filters = {};
      if (category) filters.category = category;
      if (free_only === 'true') filters.freeOnly = true;
      filters.limit = Math.min(parseInt(limit) || 20, 100);

      const templates = await db.getWorkflowTemplates(filters);

      res.json({
        success: true,
        templates,
        total: templates.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/workflows/templates/:id - 获取模板详情
  router.get('/templates/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const template = await db.getWorkflowTemplate(parseInt(id));

      if (!template) {
        return res.status(404).json({ error: '模板不存在' });
      }

      res.json({
        success: true,
        template
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/workflows/templates/:id/install - 安装模板
  router.post('/templates/:id/install', authenticate, TierGuard.requireWorkflowSlot(), async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const template = await db.getWorkflowTemplate(parseInt(id));

      if (!template) {
        return res.status(404).json({ error: '模板不存在' });
      }

      // 检查购买权限（如果是付费模板）
      if (template.price > 0) {
        const hasAccess = await db.hasTemplateAccess(req.user.userId, parseInt(id));
        if (!hasAccess) {
          return res.status(402).json({ error: '请先购买此模板' });
        }
      }

      // 创建用户工作流
      const userWorkflowId = await db.createUserWorkflow(
        req.user.userId,
        {
          template_id: parseInt(id),
          name: name || template.name,
          source_format: template.source_format,
          original_json: template.source_json,
          node_mappings: template.preset_mapping,
          n8n_workflow_id: null
        }
      );

      // 增加模板安装计数
      await db.incrementTemplateInstalls(parseInt(id));

      res.json({
        success: true,
        userWorkflowId,
        message: '模板安装成功'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== 用户工作流管理 ==========

  // GET /api/workflows/my - 获取我的工作流
  router.get('/my', authenticate, async (req, res) => {
    try {
      const { status } = req.query;
      const workflows = await db.getUserWorkflows(req.user.userId, status);

      res.json({
        success: true,
        workflows,
        total: workflows.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/workflows/my/:id - 获取工作流详情
  router.get('/my/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const workflow = await db.getUserWorkflowById(parseInt(id), req.user.userId);

      if (!workflow) {
        return res.status(404).json({ error: '工作流不存在' });
      }

      res.json({
        success: true,
        workflow
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/workflows/my/:id - 更新工作流
  router.put('/my/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, status, n8n_workflow_id, node_mappings } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (status !== undefined) updates.status = status;
      if (n8n_workflow_id !== undefined) updates.n8n_workflow_id = n8n_workflow_id;
      if (node_mappings !== undefined) updates.node_mappings = node_mappings;

      const changes = await db.updateUserWorkflow(parseInt(id), req.user.userId, updates);

      if (changes === 0) {
        return res.status(404).json({ error: '工作流不存在' });
      }

      res.json({
        success: true,
        message: '工作流已更新'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/workflows/my/:id - 删除工作流
  router.delete('/my/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      const changes = await db.deleteUserWorkflow(parseInt(id), req.user.userId);

      if (changes === 0) {
        return res.status(404).json({ error: '工作流不存在' });
      }

      res.json({
        success: true,
        message: '工作流已删除'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== AI 使用统计 ==========

  // GET /api/workflows/usage - 获取使用统计
  router.get('/usage', authenticate, async (req, res) => {
    try {
      const monthlyStats = await UsageMeter.getMonthlyStats(db, req.user.userId);
      const history = await UsageMeter.getUsageHistory(db, req.user.userId, 50);

      res.json({
        success: true,
        monthlyStats,
        history
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/workflows/usage/monthly - 获取月度使用详情
  router.get('/usage/monthly', authenticate, async (req, res) => {
    try {
      const stats = await UsageMeter.getMonthlyStats(db, req.user.userId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createWorkflowsRouter };
