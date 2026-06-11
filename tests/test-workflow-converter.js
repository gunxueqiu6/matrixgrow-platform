/**
 * Workflow Converter - 工作流转换单元测试
 *
 * 测试 IR → n8n JSON 转换的各个节点类型和连接转换
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { WorkflowConverter } = require('../utils/workflow-converter');
const { WorkflowIR, WorkflowNode } = require('../utils/workflow-ir');

describe('WorkflowConverter', () => {
  let converter;

  before(() => {
    converter = new WorkflowConverter();
  });

  // ==================== Basic Conversion ====================

  describe('convert', () => {
    it('should convert an empty IR to a basic n8n workflow', () => {
      const ir = new WorkflowIR();
      const result = converter.convert(ir);
      assert.ok(result.workflow);
      assert.strictEqual(result.workflow.name, '未命名工作流');
      assert.strictEqual(result.workflow.active, true);
      assert.deepStrictEqual(result.workflow.nodes, []);
      assert.deepStrictEqual(result.workflow.connections, {});
    });

    it('should convert a simple workflow with start and end nodes', () => {
      const ir = new WorkflowIR({
        nodes: [
          { id: 'n1', type: 'start', label: '开始', position: { x: 0, y: 0 } },
          { id: 'n2', type: 'end', label: '结束', position: { x: 200, y: 0 } },
        ],
        edges: [{ from: 'n1', to: 'n2' }],
        metadata: { name: '简单工作流' },
      });

      const result = converter.convert(ir);
      const wf = result.workflow;

      assert.strictEqual(wf.name, '简单工作流');
      assert.strictEqual(wf.nodes.length, 2);
      assert.strictEqual(wf.nodes[0].type, 'n8n-nodes-base.webhook');
      assert.strictEqual(wf.nodes[1].type, 'n8n-nodes-base.respondToWebhook');
    });
  });

  // ==================== Node Types ====================

  describe('convertNode - start', () => {
    it('should create a webhook node', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'start', label: '开始', position: { x: 0, y: 0 } }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'n8n-nodes-base.webhook');
      assert.strictEqual(node.parameters.httpMethod, 'POST');
      assert.ok(node.parameters.path);
    });
  });

  describe('convertNode - end', () => {
    it('should create a respondToWebhook node', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'end', label: '结束', position: { x: 100, y: 100 } }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'n8n-nodes-base.respondToWebhook');
      assert.strictEqual(node.parameters.responseBody, '={{ $json }}');
    });
  });

  describe('convertNode - llm', () => {
    it('should create an LLM code node with provider and model', () => {
      const ir = new WorkflowIR({
        nodes: [{
          id: 'n1', type: 'llm', label: 'LLM 节点',
          selectedProvider: 'deepseek',
          selectedModel: 'deepseek-chat',
          config: { prompt: '写一篇技术文章' },
          position: { x: 200, y: 100 },
        }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'matrixgrow-nodes.llm');
    });

    it('should default provider to deepseek when not specified', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'llm', label: 'LLM', config: { prompt: 'hi' } }],
      });
      const result = converter.convert(ir);
      assert.ok(result.workflow.nodes[0].parameters.jsCode.includes('"deepseek"'));
    });
  });

  describe('convertNode - code', () => {
    it('should create a code node with jsCode', () => {
      const ir = new WorkflowIR({
        nodes: [{
          id: 'n1', type: 'code', label: '代码节点',
          config: { code: 'return items.map(i => ({...i, processed: true}));' },
        }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'n8n-nodes-base.code');
      assert.strictEqual(node.parameters.jsCode, 'return items.map(i => ({...i, processed: true}));');
    });

    it('should use default code when none provided', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'code', label: '代码' }],
      });
      const result = converter.convert(ir);
      assert.strictEqual(result.workflow.nodes[0].parameters.jsCode, 'return items;');
    });
  });

  describe('convertNode - condition', () => {
    it('should create an IF node with conditions', () => {
      const ir = new WorkflowIR({
        nodes: [{
          id: 'n1', type: 'condition', label: '条件分支',
          config: {
            conditions: [
              { left: '{{ $json.score }}', operator: 'greaterThan', right: '80' },
              { left: '{{ $json.status }}', operator: 'equals', right: 'active' },
            ],
          },
        }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'n8n-nodes-base.if');
      assert.strictEqual(node.parameters.conditions.combinator, 'and');
      assert.strictEqual(node.parameters.conditions.conditions.length, 2);
      assert.strictEqual(node.parameters.conditions.conditions[0].leftValue, '{{ $json.score }}');
    });

    it('should handle empty conditions gracefully', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'condition', label: '条件' }],
      });
      const result = converter.convert(ir);
      assert.deepStrictEqual(result.workflow.nodes[0].parameters.conditions.conditions, []);
    });
  });

  describe('convertNode - loop', () => {
    it('should create a splitInBatches node', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'loop', label: '循环' }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'n8n-nodes-base.splitInBatches');
      assert.strictEqual(node.parameters.fieldToSplitOut, 'items');
    });
  });

  describe('convertNode - http', () => {
    it('should create an HTTP request node', () => {
      const ir = new WorkflowIR({
        nodes: [{
          id: 'n1', type: 'http', label: 'HTTP 请求',
          config: {
            url: 'https://api.example.com/data',
            method: 'POST',
            headers: { 'Authorization': 'Bearer token123' },
            body: { name: 'test', value: 42 },
          },
        }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'n8n-nodes-base.httpRequest');
      assert.strictEqual(node.parameters.url, 'https://api.example.com/data');
      assert.strictEqual(node.parameters.method, 'POST');
      assert.strictEqual(node.parameters.headers.parameters.length, 1);
      assert.strictEqual(node.parameters.sendBody, true);
      assert.strictEqual(node.parameters.bodyParameters.parameters.length, 2);
    });

    it('should handle HTTP without body or headers', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'http', label: 'HTTP', config: { url: 'https://test.com', method: 'GET' } }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.parameters.sendBody, false);
      assert.deepStrictEqual(node.parameters.headers, {});
    });
  });

  describe('convertNode - json_stringify / json_parse', () => {
    it('should create a JSON stringify node', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'json_stringify', label: 'JSON 序列化' }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.parameters.values.string[0].value, '={{ JSON.stringify($json) }}');
    });

    it('should create a JSON parse node', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'json_parse', label: 'JSON 解析' }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.parameters.values.string[0].value, '={{ JSON.parse($json.data) }}');
    });
  });

  describe('convertNode - variable', () => {
    it('should create a Set node with variables', () => {
      const ir = new WorkflowIR({
        nodes: [{
          id: 'n1', type: 'variable', label: '变量设置',
          config: { variables: { name: 'Alice', role: 'admin', count: 3 } },
        }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'n8n-nodes-base.set');
      assert.strictEqual(node.parameters.values.string.length, 3);
      assert.strictEqual(node.parameters.values.string[0].name, 'name');
      assert.strictEqual(node.parameters.values.string[0].value, 'Alice');
    });

    it('should handle empty variables', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'variable', label: '变量' }],
      });
      const result = converter.convert(ir);
      assert.deepStrictEqual(result.workflow.nodes[0].parameters.values.string, []);
    });
  });

  describe('convertNode - image_gen', () => {
    it('should create an image generation node', () => {
      const ir = new WorkflowIR({
        nodes: [{
          id: 'n1', type: 'image_gen', label: '图片生成',
          selectedProvider: 'fal',
          config: { prompt: 'a beautiful sunset' },
        }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.ok(node.parameters.jsCode.includes('fal'));
      assert.ok(node.parameters.jsCode.includes('a beautiful sunset'));
    });

    it('should default provider to fal', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'image_gen', label: '图片', config: { prompt: 'test' } }],
      });
      const result = converter.convert(ir);
      assert.ok(result.workflow.nodes[0].parameters.jsCode.includes('"fal"'));
    });
  });

  describe('convertNode - video_gen', () => {
    it('should create a video generation node', () => {
      const ir = new WorkflowIR({
        nodes: [{
          id: 'n1', type: 'video_gen', label: '视频生成',
          selectedProvider: 'heygen',
          config: { prompt: '产品介绍视频' },
        }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.ok(node.parameters.jsCode.includes('heygen'));
      assert.ok(node.parameters.jsCode.includes('产品介绍视频'));
    });

    it('should default provider to heygen', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'video_gen', label: '视频', config: { prompt: 'test' } }],
      });
      const result = converter.convert(ir);
      assert.ok(result.workflow.nodes[0].parameters.jsCode.includes('"heygen"'));
    });
  });

  describe('convertNode - default/unknown', () => {
    it('should create a code node for unknown types', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'custom_plugin', label: '自定义', originalData: { some: 'data' } }],
      });
      const result = converter.convert(ir);
      const node = result.workflow.nodes[0];
      assert.strictEqual(node.type, 'n8n-nodes-base.code');
      assert.ok(node.parameters.jsCode.includes('custom_plugin'));
    });
  });

  // ==================== Node Naming ====================

  describe('node naming', () => {
    it('should sanitize node names', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'start', label: '中文 标签 with spaces!@#', position: { x: 0, y: 0 } }],
      });
      const result = converter.convert(ir);
      assert.ok(result.workflow.nodes[0].name);
      // Should contain sanitized version of the label
      assert.ok(result.workflow.nodes[0].name.includes('中文'));
      assert.ok(result.workflow.nodes[0].name.includes('_1'));
    });

    it('should use default position when not specified', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'n1', type: 'start', label: '开始' }],
      });
      const result = converter.convert(ir);
      const pos = result.workflow.nodes[0].position;
      assert.strictEqual(pos[0], 200); // index * 200
      assert.strictEqual(pos[1], 100); // index * 100
    });
  });

  // ==================== Edge Conversion ====================

  describe('convertEdges', () => {
    it('should convert simple edges', () => {
      const ir = new WorkflowIR({
        nodes: [
          { id: 'a', type: 'start', label: '开始' },
          { id: 'b', type: 'end', label: '结束' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      });
      const result = converter.convert(ir);
      const conns = result.workflow.connections;
      const firstName = result.workflow.nodes[0].name;
      const secondName = result.workflow.nodes[1].name;
      assert.ok(conns[firstName]);
      assert.strictEqual(conns[firstName].main[0][0].node, secondName);
      assert.strictEqual(conns[firstName].main[0][0].type, 'main');
    });

    it('should handle false condition edges on output index 1', () => {
      const ir = new WorkflowIR({
        nodes: [
          { id: 'a', type: 'condition', label: '条件' },
          { id: 'b', type: 'end', label: 'False 分支' },
        ],
        edges: [{ from: 'a', to: 'b', condition: 'false' }],
      });
      const result = converter.convert(ir);
      const conns = result.workflow.connections;
      const firstName = result.workflow.nodes[0].name;
      // False condition goes to output index 1
      assert.ok(conns[firstName].main[1]);
      assert.strictEqual(conns[firstName].main[1][0].node, result.workflow.nodes[1].name);
    });

    it('should skip edges with unknown node references', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'a', type: 'start', label: '开始' }],
        edges: [{ from: 'a', to: 'nonexistent' }, { from: 'nonexistent2', to: 'a' }],
      });
      const result = converter.convert(ir);
      // Only edges with valid node references get processed
      assert.deepStrictEqual(result.workflow.connections, {});
    });
  });

  // ==================== Warning Collection ====================

  describe('collectWarnings', () => {
    it('should collect node-level warnings', () => {
      const n1 = new WorkflowNode({ id: 'a', type: 'knowledge', label: '知识库' });
      n1.warnings.push('知识库节点需要手动配置连接');
      const ir = new WorkflowIR({ nodes: [n1] });
      const result = converter.convert(ir);
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings[0].includes('知识库'));
    });

    it('should collect validation warnings', () => {
      const ir = new WorkflowIR({
        nodes: [{ id: 'a', type: 'llm', label: 'LLM' }],
      });
      const result = converter.convert(ir);
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings[0].includes('LLM'));
    });
  });

  // ==================== Complex Workflow ====================

  describe('complex workflow conversion', () => {
    it('should convert a full workflow with multiple node types', () => {
      const ir = new WorkflowIR({
        nodes: [
          { id: 's', type: 'start', label: 'Webhook 开始' },
          { id: 'llm', type: 'llm', label: 'AI 处理', config: { prompt: '分析内容' }, selectedProvider: 'openai', selectedModel: 'gpt-4' },
          { id: 'cond', type: 'condition', label: '质量检查', config: { conditions: [{ left: '$json.score', operator: 'greaterThan', right: '0.8' }] } },
          { id: 'code', type: 'code', label: '格式化输出', config: { code: 'return [{ json: items[0].json }];' } },
          { id: 'e', type: 'end', label: '完成' },
        ],
        edges: [
          { from: 's', to: 'llm' },
          { from: 'llm', to: 'cond' },
          { from: 'cond', to: 'code' },
          { from: 'code', to: 'e' },
        ],
        metadata: { name: '完整工作流' },
      });

      const result = converter.convert(ir);
      const wf = result.workflow;

      assert.strictEqual(wf.nodes.length, 5);
      assert.strictEqual(wf.name, '完整工作流');

      // Verify specific node types
      const types = wf.nodes.map(n => n.type);
      assert.ok(types.includes('n8n-nodes-base.webhook'));
      assert.ok(types.includes('n8n-nodes-base.if'));
      assert.ok(types.includes('n8n-nodes-base.code'));

      // Verify connections exist between all nodes
      assert.strictEqual(Object.keys(wf.connections).length, 4);
    });
  });
});
