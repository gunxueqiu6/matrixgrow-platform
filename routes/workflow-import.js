/**
 * Workflow Import Routes - 工作流导入相关 API
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { TierGuard } = require('../utils/tier-guard');
const { WorkflowImporter } = require('../utils/workflow-importer');
const { ModelMapping } = require('../utils/model-mapping');

function createWorkflowImportRouter(db) {
  const router = express.Router();
  const importer = new WorkflowImporter();

  // 存储临时导入会话（生产环境应使用 Redis）
  const importSessions = new Map();

  // POST /api/workflow/import - 上传并解析工作流文件
  router.post('/import', authenticate, TierGuard.requireWorkflowSlot(), async (req, res) => {
    try {
      const { content, source, auto_detect = true } = req.body;

      if (!content) {
        return res.status(400).json({ error: '缺少工作流内容' });
      }

      const result = await importer.importWorkflow(content, { source, auto_detect });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // 保存临时会话（30 分钟过期）
      importSessions.set(result.importId, {
        ir: result.ir,
        source: result.source,
        nodeMappings: {},
        userId: req.user.userId
      });
      setTimeout(() => importSessions.delete(result.importId), 30 * 60 * 1000);

      res.json({
        success: true,
        importId: result.importId,
        detectedNodes: result.detectedNodes,
        availableModels: result.availableModels,
        source: result.source
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/workflow/import/:importId/mapping - 配置节点映射
  router.put('/import/:importId/mapping', authenticate, TierGuard.requireWorkflowSlot(), async (req, res) => {
    try {
      const { importId } = req.params;
      const { nodeMappings } = req.body;

      const session = importSessions.get(importId);

      if (!session) {
        return res.status(404).json({ error: '导入会话不存在或已过期' });
      }

      if (session.userId !== req.user.userId) {
        return res.status(403).json({ error: '无权访问此会话' });
      }

      // 更新会话中的映射
      session.nodeMappings = nodeMappings;

      // 转换工作流
      const convertResult = await importer.convertWithMappings(importId, nodeMappings);

      if (!convertResult.success) {
        return res.status(400).json({ error: convertResult.error, warnings: convertResult.warnings });
      }

      res.json({
        success: true,
        n8nWorkflow: convertResult.n8nWorkflow,
        warnings: convertResult.warnings
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/workflow/import/:importId/install - 安装到 n8n
  router.post('/import/:importId/install', authenticate, TierGuard.requireWorkflowSlot(), async (req, res) => {
    try {
      const { importId } = req.params;
      const { name } = req.body;

      const session = importSessions.get(importId);

      if (!session) {
        return res.status(404).json({ error: '导入会话不存在或已过期' });
      }

      if (session.userId !== req.user.userId) {
        return res.status(403).json({ error: '无权访问此会话' });
      }

      // 再次转换确保有最新的工作流
      const convertResult = await importer.convertWithMappings(importId, session.nodeMappings);

      if (!convertResult.success) {
        return res.status(400).json({ error: convertResult.error });
      }

      // 保存到用户工作流表
      const userWorkflowId = await db.createUserWorkflow(
        req.user.userId,
        {
          name: name || '导入的工作流',
          source_format: session.source,
          original_json: session.ir,
          n8n_workflow_id: null, // 这里应该调用 n8n API 实际创建
          node_mappings: session.nodeMappings
        }
      );

      // 清理会话
      importSessions.delete(importId);

      res.json({
        success: true,
        userWorkflowId,
        message: '工作流安装成功'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createWorkflowImportRouter };
