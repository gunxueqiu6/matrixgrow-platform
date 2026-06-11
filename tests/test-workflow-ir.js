/**
 * Workflow IR - 中间表示单元测试
 *
 * 测试 WorkflowNode, WorkflowEdge, WorkflowIR 三个核心类
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { WorkflowNode, WorkflowEdge, WorkflowIR } = require('../utils/workflow-ir');

// ==================== WorkflowNode ====================

describe('WorkflowNode', () => {
  it('should create a node with default values', () => {
    const node = new WorkflowNode({ id: 'test_1', type: 'llm' });
    assert.strictEqual(node.id, 'test_1');
    assert.strictEqual(node.type, 'llm');
    assert.strictEqual(node.label, '未命名节点');
    assert.deepStrictEqual(node.config, {});
    assert.deepStrictEqual(node.position, { x: 0, y: 0 });
    assert.strictEqual(node.requiresMapping, false);
    assert.deepStrictEqual(node.supportedProviders, []);
    assert.strictEqual(node.selectedProvider, null);
    assert.strictEqual(node.selectedModel, null);
    assert.deepStrictEqual(node.warnings, []);
  });

  it('should create a node with all fields', () => {
    const node = new WorkflowNode({
      id: 'coze_1',
      type: 'llm',
      label: 'GPT 节点',
      config: { prompt: '你好', model: 'gpt-4' },
      position: { x: 100, y: 200 },
      originalType: '3',
      originalData: { someField: 'value' },
      requiresMapping: true,
      supportedProviders: ['openai', 'claude'],
      selectedProvider: 'openai',
      selectedModel: 'gpt-4',
      warnings: ['测试警告'],
    });

    assert.strictEqual(node.id, 'coze_1');
    assert.strictEqual(node.type, 'llm');
    assert.strictEqual(node.label, 'GPT 节点');
    assert.deepStrictEqual(node.config, { prompt: '你好', model: 'gpt-4' });
    assert.deepStrictEqual(node.position, { x: 100, y: 200 });
    assert.strictEqual(node.originalType, '3');
    assert.strictEqual(node.requiresMapping, true);
    assert.deepStrictEqual(node.supportedProviders, ['openai', 'claude']);
    assert.strictEqual(node.selectedProvider, 'openai');
    assert.strictEqual(node.selectedModel, 'gpt-4');
    assert.deepStrictEqual(node.warnings, ['测试警告']);
  });

  it('should prefer label over name', () => {
    const node = new WorkflowNode({ id: 'n1', type: 'code', label: '标签名', name: '名字' });
    assert.strictEqual(node.label, '标签名');
  });

  it('should fallback to name when label is missing', () => {
    const node = new WorkflowNode({ id: 'n1', type: 'code', name: '名字' });
    assert.strictEqual(node.label, '名字');
  });

  it('should serialize to JSON correctly', () => {
    const node = new WorkflowNode({ id: 'n1', type: 'start', label: '开始' });
    const json = node.toJSON();
    assert.strictEqual(json.id, 'n1');
    assert.strictEqual(json.type, 'start');
    assert.strictEqual(json.label, '开始');
    // originalData 不序列化
    assert.strictEqual(json.originalData, undefined);
  });

  it('should deserialize from JSON correctly', () => {
    const json = {
      id: 'n1', type: 'llm', label: 'LLM', config: { prompt: 'test' },
      position: { x: 10, y: 20 }, requiresMapping: true,
      supportedProviders: ['claude'], selectedProvider: 'claude',
      selectedModel: 'sonnet', warnings: [],
    };
    const node = WorkflowNode.fromJSON(json);
    assert.strictEqual(node.id, 'n1');
    assert.strictEqual(node.label, 'LLM');
    assert.strictEqual(node.selectedProvider, 'claude');
  });

  it('should handle empty data gracefully', () => {
    const node = new WorkflowNode({});
    assert.strictEqual(node.id, undefined);
    assert.strictEqual(node.type, undefined);
    assert.strictEqual(node.label, '未命名节点');
  });
});

// ==================== WorkflowEdge ====================

describe('WorkflowEdge', () => {
  it('should create an edge from from/to', () => {
    const edge = new WorkflowEdge({ from: 'a', to: 'b' });
    assert.strictEqual(edge.id, 'a-b');
    assert.strictEqual(edge.from, 'a');
    assert.strictEqual(edge.to, 'b');
    assert.strictEqual(edge.condition, null);
  });

  it('should create an edge with custom id and condition', () => {
    const edge = new WorkflowEdge({
      id: 'custom-edge',
      from: 'node_1',
      to: 'node_2',
      condition: 'false',
      originalData: { type: 'if-else' },
    });
    assert.strictEqual(edge.id, 'custom-edge');
    assert.strictEqual(edge.condition, 'false');
  });

  it('should serialize to JSON', () => {
    const edge = new WorkflowEdge({ from: 'x', to: 'y', condition: 'true' });
    const json = edge.toJSON();
    assert.strictEqual(json.from, 'x');
    assert.strictEqual(json.to, 'y');
    assert.strictEqual(json.condition, 'true');
    assert.strictEqual(json.id, 'x-y');
  });

  it('should deserialize from JSON', () => {
    const edge = WorkflowEdge.fromJSON({ from: 'a', to: 'b', condition: 'false' });
    assert.strictEqual(edge.from, 'a');
    assert.strictEqual(edge.to, 'b');
    assert.strictEqual(edge.condition, 'false');
  });

  it('should handle empty data gracefully', () => {
    const edge = new WorkflowEdge({});
    assert.strictEqual(edge.id, 'undefined-undefined');
    assert.strictEqual(edge.from, undefined);
    assert.strictEqual(edge.to, undefined);
  });
});

// ==================== WorkflowIR ====================

describe('WorkflowIR', () => {
  it('should create an empty IR with defaults', () => {
    const ir = new WorkflowIR();
    assert.deepStrictEqual(ir.nodes, []);
    assert.deepStrictEqual(ir.edges, []);
    assert.strictEqual(ir.metadata.name, '未命名工作流');
    assert.strictEqual(ir.metadata.sourceFormat, 'unknown');
    assert.ok(ir.importId.startsWith('import_'));
  });

  it('should create IR from raw data', () => {
    const ir = new WorkflowIR({
      nodes: [{ id: 'n1', type: 'start', label: '开始' }],
      edges: [{ from: 'n1', to: 'n2' }],
      metadata: { name: '我的工作流', sourceFormat: 'coze' },
    });
    assert.strictEqual(ir.nodes.length, 1);
    assert.strictEqual(ir.nodes[0] instanceof WorkflowNode, true);
    assert.strictEqual(ir.nodes[0].label, '开始');
    assert.strictEqual(ir.edges.length, 1);
    assert.strictEqual(ir.metadata.name, '我的工作流');
  });

  it('should keep WorkflowNode instances as-is', () => {
    const n = new WorkflowNode({ id: 'n1', type: 'code' });
    const ir = new WorkflowIR({ nodes: [n] });
    assert.strictEqual(ir.nodes[0], n);
  });

  // ---- addNode / addEdge ----

  it('should add nodes and edges', () => {
    const ir = new WorkflowIR();
    const n = ir.addNode({ id: 'n1', type: 'start' });
    assert.strictEqual(n instanceof WorkflowNode, true);
    assert.strictEqual(ir.nodes.length, 1);
    assert.strictEqual(n.id, 'n1');

    const e = ir.addEdge({ from: 'n1', to: 'n2' });
    assert.strictEqual(e instanceof WorkflowEdge, true);
    assert.strictEqual(ir.edges.length, 1);
  });

  it('should re-use WorkflowNode when adding', () => {
    const ir = new WorkflowIR();
    const n = new WorkflowNode({ id: 'x', type: 'llm' });
    const added = ir.addNode(n);
    assert.strictEqual(added, n);
  });

  // ---- getNode ----

  it('should find node by id', () => {
    const ir = new WorkflowIR({ nodes: [{ id: 'a', type: 'start' }, { id: 'b', type: 'end' }] });
    assert.strictEqual(ir.getNode('a').id, 'a');
    assert.strictEqual(ir.getNode('b').id, 'b');
    assert.strictEqual(ir.getNode('nonexistent'), undefined);
  });

  // ---- getNodesByType ----

  it('should filter nodes by type', () => {
    const ir = new WorkflowIR({
      nodes: [
        { id: 'a', type: 'start' },
        { id: 'b', type: 'llm' },
        { id: 'c', type: 'llm' },
        { id: 'd', type: 'end' },
      ],
    });
    const llms = ir.getNodesByType('llm');
    assert.strictEqual(llms.length, 2);
    assert.strictEqual(ir.getNodesByType('start').length, 1);
    assert.strictEqual(ir.getNodesByType('nonexistent').length, 0);
  });

  // ---- getDetectedNodes ----

  it('should return detected node types', () => {
    const ir = new WorkflowIR({
      nodes: [
        { id: 'a', type: 'start', label: '开始', requiresMapping: false },
        { id: 'b', type: 'llm', label: 'LLM', requiresMapping: true, supportedProviders: ['claude', 'openai'], selectedModel: 'gpt-4' },
      ],
    });
    const detected = ir.getDetectedNodes();
    assert.ok(detected.start);
    assert.strictEqual(detected.start.length, 1);
    assert.ok(detected.llm);
    assert.strictEqual(detected.llm[0].requiresMapping, true);
    assert.strictEqual(detected.llm[0].currentModel, 'gpt-4');
  });

  // ---- updateNodeMappings ----

  it('should update node mappings', () => {
    const ir = new WorkflowIR({ nodes: [{ id: 'n1', type: 'llm', label: 'LLM' }] });
    ir.updateNodeMappings({
      n1: { provider: 'claude', model: 'sonnet', config: { prompt: '新的提示' } },
    });
    assert.strictEqual(ir.getNode('n1').selectedProvider, 'claude');
    assert.strictEqual(ir.getNode('n1').selectedModel, 'sonnet');
    assert.strictEqual(ir.getNode('n1').config.prompt, '新的提示');
  });

  it('should not crash when updating nonexistent node', () => {
    const ir = new WorkflowIR();
    ir.updateNodeMappings({ nonexistent: { provider: 'openai' } });
    assert.strictEqual(ir.nodes.length, 0);
  });

  // ---- validate ----

  it('should validate a correct workflow', () => {
    const ir = new WorkflowIR({
      nodes: [{ id: 'a', type: 'start' }, { id: 'b', type: 'end' }],
      edges: [{ from: 'a', to: 'b' }],
    });
    const result = ir.validate();
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.warnings.length, 0);
  });

  it('should catch orphaned edges', () => {
    const ir = new WorkflowIR({
      nodes: [{ id: 'a', type: 'start' }],
      edges: [{ from: 'a', to: 'nonexistent' }, { from: 'nonexistent2', to: 'a' }],
    });
    const result = ir.validate();
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errors.length, 2);
  });

  it('should warn about LLM nodes without provider', () => {
    const ir = new WorkflowIR({
      nodes: [
        { id: 'a', type: 'llm', label: 'LLM 节点' },
        { id: 'b', type: 'start' },
      ],
    });
    const result = ir.validate();
    assert.strictEqual(result.valid, true); // warnings don't invalidate
    assert.strictEqual(result.warnings.length, 1);
    assert.ok(result.warnings[0].includes('LLM 节点'));
  });

  it('should warn about image_gen nodes without provider', () => {
    const ir = new WorkflowIR({
      nodes: [{ id: 'a', type: 'image_gen', label: '图片生成' }],
    });
    const result = ir.validate();
    assert.strictEqual(result.warnings.length, 1);
    assert.ok(result.warnings[0].includes('图片生成'));
  });

  it('should not warn about nodes with provider set', () => {
    const ir = new WorkflowIR({
      nodes: [{ id: 'a', type: 'llm', label: 'LLM', selectedProvider: 'deepseek' }],
    });
    const result = ir.validate();
    assert.strictEqual(result.warnings.length, 0);
  });

  // ---- toJSON / fromJSON roundtrip ----

  it('should roundtrip through JSON', () => {
    const ir1 = new WorkflowIR({
      nodes: [{ id: 'n1', type: 'start' }, { id: 'n2', type: 'llm', selectedProvider: 'openai' }],
      edges: [{ from: 'n1', to: 'n2' }],
      metadata: { name: '往返测试', sourceFormat: 'coze' },
    });
    const json = ir1.toJSON();
    const ir2 = WorkflowIR.fromJSON(json);
    assert.strictEqual(ir2.nodes.length, 2);
    assert.strictEqual(ir2.edges.length, 1);
    assert.strictEqual(ir2.metadata.name, '往返测试');
    assert.strictEqual(ir2.getNode('n2').selectedProvider, 'openai');
  });

  // ---- Edge cases ----

  it('should handle empty workflow gracefully', () => {
    const ir = new WorkflowIR();
    const result = ir.validate();
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(ir.getDetectedNodes(), {});
    assert.strictEqual(ir.getNode('x'), undefined);
  });

  it('should handle many nodes and edges', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      id: `n${i}`, type: i === 0 ? 'start' : i === 99 ? 'end' : 'code', label: `节点${i}`,
    }));
    const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
    const ir = new WorkflowIR({ nodes, edges });
    assert.strictEqual(ir.nodes.length, 100);
    assert.strictEqual(ir.edges.length, 99);
    const result = ir.validate();
    assert.strictEqual(result.valid, true);
  });
});
