/**
 * Workflow Importer - 工作流导入器单元测试
 *
 * 测试完整导入管线：检测格式 → 解析 → IR → 转换 → 返回结果
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { WorkflowImporter } = require('../utils/workflow-importer');
const { createCozeWorkflow, createDifyWorkflow } = require('./test-helpers');

describe('WorkflowImporter', () => {
  let importer;

  before(() => {
    importer = new WorkflowImporter();
  });

  // ==================== detectFormat ====================

  describe('detectFormat', () => {
    it('should detect Coze format', () => {
      const workflow = createCozeWorkflow();
      const format = importer.detectFormat(workflow);
      assert.strictEqual(format, 'coze');
    });

    it('should detect Dify format', () => {
      const workflow = createDifyWorkflow();
      const format = importer.detectFormat(workflow);
      assert.strictEqual(format, 'dify');
    });

    it('should return null for unknown format', () => {
      const result = importer.detectFormat({ randomField: true });
      assert.strictEqual(result, null);
    });

    it('should detect from JSON string', () => {
      const workflow = createCozeWorkflow();
      const format = importer.detectFormat(JSON.stringify(workflow));
      assert.strictEqual(format, 'coze');
    });
  });

  // ==================== parseContent ====================

  describe('parseContent', () => {
    it('should parse JSON string to object', () => {
      const result = importer.parseContent('{"name":"test"}');
      assert.deepStrictEqual(result, { name: 'test' });
    });

    it('should return object as-is', () => {
      const obj = { name: 'test' };
      const result = importer.parseContent(obj);
      assert.strictEqual(result, obj);
    });

    it('should return invalid JSON string as-is', () => {
      const result = importer.parseContent('not-json');
      assert.strictEqual(result, 'not-json');
    });
  });

  // ==================== importWorkflow ====================

  describe('importWorkflow', () => {
    it('should import a Coze workflow with auto-detection', async () => {
      const workflow = createCozeWorkflow();
      const result = await importer.importWorkflow(workflow);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.source, 'coze');
      assert.ok(result.importId);
      assert.ok(result.ir);
      assert.ok(result.ir.nodes);
      assert.ok(result.detectedNodes);
    });

    it('should import a Dify workflow with auto-detection', async () => {
      const workflow = createDifyWorkflow();
      const result = await importer.importWorkflow(workflow);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.source, 'dify');
      assert.ok(result.importId);
    });

    it('should respect explicit source parameter', async () => {
      // Create a coze-like workflow but pass source explicitly
      const workflow = createCozeWorkflow();
      const result = await importer.importWorkflow(workflow, { source: 'coze' });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.source, 'coze');
    });

    it('should import from JSON string content', async () => {
      const workflow = createCozeWorkflow();
      const result = await importer.importWorkflow(JSON.stringify(workflow));

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.source, 'coze');
    });

    it('should throw on unsupported format', async () => {
      await assert.rejects(
        () => importer.importWorkflow({ nodes: [] }, { source: 'unsupported' }),
        /不支持的工作流格式/
      );
    });

    it('should throw when format cannot be detected', async () => {
      await assert.rejects(
        () => importer.importWorkflow({ randomData: true }),
        /无法检测工作流格式/
      );
    });

    it('should return available models in result', async () => {
      const workflow = createCozeWorkflow();
      const result = await importer.importWorkflow(workflow);

      assert.ok(result.availableModels);
      assert.ok(result.availableModels.llm);
      assert.ok(result.availableModels.image);
      assert.ok(result.availableModels.video);
    });
  });

  // ==================== updateMappings ====================

  describe('updateMappings', () => {
    it('should update node mappings and return n8n workflow', async () => {
      const workflow = createCozeWorkflow();
      const importResult = await importer.importWorkflow(workflow);
      const importId = importResult.importId;

      const result = await importer.updateMappings(importId, {
        coze_2: { provider: 'deepseek', model: 'deepseek-chat' },
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.n8nWorkflow);
      assert.strictEqual(result.n8nWorkflow.name, '测试工作流');
      assert.ok(result.n8nWorkflow.nodes.length > 0);
    });

    it('should throw for nonexistent import session', async () => {
      await assert.rejects(
        () => importer.updateMappings('nonexistent-id', {}),
        /导入会话不存在/
      );
    });
  });

  // ==================== convertWithMappings ====================

  describe('convertWithMappings', () => {
    it('should convert with mappings and return result', async () => {
      const workflow = createCozeWorkflow();
      const importResult = await importer.importWorkflow(workflow);
      const importId = importResult.importId;

      const result = await importer.convertWithMappings(importId, {
        coze_2: { provider: 'openai', model: 'gpt-4' },
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.n8nWorkflow);
    });

    it('should handle errors gracefully', async () => {
      const result = await importer.convertWithMappings('invalid-id', {});
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  // ==================== getPreview ====================

  describe('getPreview', () => {
    it('should return workflow preview without requiring mappings', async () => {
      const workflow = createCozeWorkflow();
      const importResult = await importer.importWorkflow(workflow);
      const importId = importResult.importId;

      const result = await importer.getPreview(importId);

      assert.strictEqual(result.success, true);
      assert.ok(result.n8nWorkflow);
      assert.strictEqual(result.n8nWorkflow.nodes.length, 3);
    });

    it('should throw for nonexistent session', async () => {
      await assert.rejects(
        () => importer.getPreview('bad-id'),
        /导入会话不存在/
      );
    });
  });

  // ==================== Session Management ====================

  describe('session management', () => {
    it('should return session info', async () => {
      const workflow = createCozeWorkflow();
      const importResult = await importer.importWorkflow(workflow);
      const session = importer.getSession(importResult.importId);
      assert.ok(session);
      assert.strictEqual(session.source, 'coze');
    });

    it('should clear sessions', async () => {
      const workflow = createCozeWorkflow();
      const importResult = await importer.importWorkflow(workflow);
      const importId = importResult.importId;

      assert.ok(importer.getSession(importId));
      importer.clearSession(importId);
      assert.strictEqual(importer.getSession(importId), undefined);
    });
  });

  // ==================== pushToN8n ====================

  describe('pushToN8n', () => {
    it('should fail gracefully when n8n is unreachable', async () => {
      await assert.rejects(
        () => importer.pushToN8n({ name: 'test' }, { n8nUrl: 'http://localhost:1' }),
        /推送 n8n 失败/
      );
    });

    it('should fail with no endpoint configured', async () => {
      const originalUrl = process.env.N8N_API_URL;
      delete process.env.N8N_API_URL;

      await assert.rejects(
        () => importer.pushToN8n({ name: 'test' }, { n8nUrl: '' }),
        /推送 n8n 失败/
      );

      if (originalUrl) process.env.N8N_API_URL = originalUrl;
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should handle workflow with only start and end nodes', async () => {
      const workflow = createCozeWorkflow({
        nodes: [
          { id: '1', type: '1', name: '开始' },
          { id: '3', type: '2', name: '结束' },
        ],
        connections: [{ from: '1', to: '3' }],
      });

      const result = await importer.importWorkflow(workflow);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.ir.nodes.length, 2);

      const preview = await importer.getPreview(result.importId);
      assert.strictEqual(preview.n8nWorkflow.nodes.length, 2);
    });

    it('should handle Dify workflow with graph structure', async () => {
      const workflow = createDifyWorkflow();
      const result = await importer.importWorkflow(workflow);
      assert.strictEqual(result.success, true);
    });

    it('should handle import with JSON string content', async () => {
      const jsonStr = JSON.stringify(createCozeWorkflow());
      const result = await importer.importWorkflow(jsonStr);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.source, 'coze');
    });
  });
});
