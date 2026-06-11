/**
 * Node Mapper - 节点类型映射引擎单元测试
 *
 * 测试节点类型在 Coze/Dify ←→ IR ←→ n8n 之间的映射
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { NodeMapper } = require('../utils/node-mapper');

describe('NodeMapper', () => {
  let mapper;

  before(() => {
    mapper = new NodeMapper();
  });

  // ==================== getIRType ====================

  describe('getIRType', () => {
    it('should map Coze types to IR types', () => {
      assert.strictEqual(mapper.getIRType('coze', '1'), 'start');
      assert.strictEqual(mapper.getIRType('coze', '2'), 'end');
      assert.strictEqual(mapper.getIRType('coze', '3'), 'llm');
      assert.strictEqual(mapper.getIRType('coze', '4'), 'code');
      assert.strictEqual(mapper.getIRType('coze', '5'), 'condition');
      assert.strictEqual(mapper.getIRType('coze', '6'), 'loop');
      assert.strictEqual(mapper.getIRType('coze', '7'), 'http');
      assert.strictEqual(mapper.getIRType('coze', '8'), 'variable');
      assert.strictEqual(mapper.getIRType('coze', '58'), 'json_stringify');
      assert.strictEqual(mapper.getIRType('coze', '59'), 'json_parse');
      assert.strictEqual(mapper.getIRType('coze', '100'), 'image_gen');
      assert.strictEqual(mapper.getIRType('coze', '101'), 'video_gen');
    });

    it('should map Dify types to IR types', () => {
      assert.strictEqual(mapper.getIRType('dify', 'start'), 'start');
      assert.strictEqual(mapper.getIRType('dify', 'end'), 'end');
      assert.strictEqual(mapper.getIRType('dify', 'llm'), 'llm');
      assert.strictEqual(mapper.getIRType('dify', 'code'), 'code');
      assert.strictEqual(mapper.getIRType('dify', 'if-else'), 'condition');
      assert.strictEqual(mapper.getIRType('dify', 'iteration'), 'loop');
      assert.strictEqual(mapper.getIRType('dify', 'http-request'), 'http');
      assert.strictEqual(mapper.getIRType('dify', 'variable-assigner'), 'variable');
      assert.strictEqual(mapper.getIRType('dify', 'knowledge-retrieval'), 'knowledge');
      assert.strictEqual(mapper.getIRType('dify', 'tool'), 'plugin');
    });

    it('should return "unknown" for unmapped sourceFormat', () => {
      assert.strictEqual(mapper.getIRType('nonexistent', 'anything'), 'unknown');
    });

    it('should return "unknown" for unmapped originalType', () => {
      assert.strictEqual(mapper.getIRType('coze', '9999'), 'unknown');
      assert.strictEqual(mapper.getIRType('dify', 'bogus_type'), 'unknown');
    });
  });

  // ==================== getN8nNodeType ====================

  describe('getN8nNodeType', () => {
    it('should return n8n type for known IR types', () => {
      assert.strictEqual(mapper.getN8nNodeType('start'), 'n8n-nodes-base.webhook');
      assert.strictEqual(mapper.getN8nNodeType('end'), 'n8n-nodes-base.respondToWebhook');
      assert.strictEqual(mapper.getN8nNodeType('condition'), 'n8n-nodes-base.if');
      assert.strictEqual(mapper.getN8nNodeType('code'), 'n8n-nodes-base.code');
    });

    it('should return default code node for unknown IR types', () => {
      assert.strictEqual(mapper.getN8nNodeType('completely_unknown'), 'n8n-nodes-base.code');
    });

    it('should cache the n8n type map', () => {
      const first = mapper.getN8nNodeType('start');
      const second = mapper.getN8nNodeType('start');
      assert.strictEqual(first, second);
    });
  });

  // ==================== getSupportedProviders ====================

  describe('getSupportedProviders', () => {
    it('should return providers for LLM nodes', () => {
      const providers = mapper.getSupportedProviders('llm');
      assert.ok(providers.includes('claude'));
      assert.ok(providers.includes('deepseek'));
      assert.ok(providers.includes('openai'));
      assert.ok(providers.includes('qwen'));
    });

    it('should return providers for image_gen nodes', () => {
      const providers = mapper.getSupportedProviders('image_gen');
      assert.ok(providers.includes('fal'));
      assert.ok(providers.includes('replicate'));
    });

    it('should return providers for video_gen nodes', () => {
      const providers = mapper.getSupportedProviders('video_gen');
      assert.ok(providers.includes('heygen'));
    });

    it('should return empty array for unknown node types', () => {
      assert.deepStrictEqual(mapper.getSupportedProviders('unknown_type'), []);
      assert.deepStrictEqual(mapper.getSupportedProviders('start'), []);
    });
  });

  // ==================== requiresMapping ====================

  describe('requiresMapping', () => {
    it('should return true for mapping-required types', () => {
      assert.strictEqual(mapper.requiresMapping('llm'), true);
      assert.strictEqual(mapper.requiresMapping('image_gen'), true);
      assert.strictEqual(mapper.requiresMapping('video_gen'), true);
      assert.strictEqual(mapper.requiresMapping('knowledge'), true);
      assert.strictEqual(mapper.requiresMapping('plugin'), true);
    });

    it('should return false for basic types', () => {
      assert.strictEqual(mapper.requiresMapping('start'), false);
      assert.strictEqual(mapper.requiresMapping('end'), false);
      assert.strictEqual(mapper.requiresMapping('code'), false);
      assert.strictEqual(mapper.requiresMapping('condition'), false);
      assert.strictEqual(mapper.requiresMapping('http'), false);
    });
  });

  // ==================== convertVariableSyntax ====================

  describe('convertVariableSyntax', () => {
    it('should convert Coze {{var}} syntax to n8n format', () => {
      const result = mapper.convertVariableSyntax(
        '{{node1.output}} 的值是 {{node2.result}}',
        'coze',
        {}
      );
      assert.strictEqual(result, '{{ $json.node1.output }} 的值是 {{ $json.node2.result }}');
    });

    it('should use nodeIdMap when available for Coze format', () => {
      const result = mapper.convertVariableSyntax(
        '{{node1.output}}',
        'coze',
        { node1: 'mapped_node_1' }
      );
      assert.strictEqual(result, '{{ $json.mapped_node_1.output }}');
    });

    it('should convert Dify {{#var#}} syntax to n8n format', () => {
      const result = mapper.convertVariableSyntax(
        '{{#start.name#}} 和 {{#llm1.result#}}',
        'dify',
        {}
      );
      assert.strictEqual(result, '{{ $json.start.name }} 和 {{ $json.llm1.result }}');
    });

    it('should use nodeIdMap when available for Dify format', () => {
      const result = mapper.convertVariableSyntax(
        '{{#start1.output#}}',
        'dify',
        { start1: 'dify_start1' }
      );
      assert.strictEqual(result, '{{ $json.dify_start1.output }}');
    });

    it('should handle single-part variable paths', () => {
      const result = mapper.convertVariableSyntax(
        '{{singlePart}}',
        'coze',
        {}
      );
      assert.strictEqual(result, '{{ $json.singlePart }}');
    });

    it('should return null/empty inputs unchanged', () => {
      assert.strictEqual(mapper.convertVariableSyntax(null, 'coze'), null);
      assert.strictEqual(mapper.convertVariableSyntax(undefined, 'coze'), undefined);
      assert.strictEqual(mapper.convertVariableSyntax('', 'coze'), '');
    });

    it('should return non-string inputs unchanged', () => {
      assert.strictEqual(mapper.convertVariableSyntax(42, 'coze'), 42);
      assert.strictEqual(mapper.convertVariableSyntax(true, 'coze'), true);
    });

    it('should handle text with no variables', () => {
      const result = mapper.convertVariableSyntax('普通文本没有变量', 'coze', {});
      assert.strictEqual(result, '普通文本没有变量');
    });

    it('should handle unknown source format by returning text unchanged', () => {
      const result = mapper.convertVariableSyntax('{{var}}', 'unknown_format', {});
      assert.strictEqual(result, '{{var}}');
    });
  });

  // ==================== convertConfig ====================

  describe('convertConfig', () => {
    it('should recursively convert config values with Coze syntax', () => {
      const config = {
        prompt: '{{node1.output}}',
        description: '静态文本',
        nested: {
          inner: '{{node2.value}}',
        },
      };
      const result = mapper.convertConfig(config, 'coze', {});
      assert.strictEqual(result.prompt, '{{ $json.node1.output }}');
      assert.strictEqual(result.description, '静态文本');
      assert.strictEqual(result.nested.inner, '{{ $json.node2.value }}');
    });

    it('should recursively convert config values with Dify syntax', () => {
      const config = {
        prompt: '{{#start.system#}}',
        nested: {
          inner: '{{#llm.result#}}',
        },
      };
      const result = mapper.convertConfig(config, 'dify', {});
      assert.strictEqual(result.prompt, '{{ $json.start.system }}');
      assert.strictEqual(result.nested.inner, '{{ $json.llm.result }}');
    });

    it('should handle arrays in config', () => {
      const config = {
        items: ['{{n1.val}}', '静态文本', '{{n2.val}}'],
      };
      const result = mapper.convertConfig(config, 'coze', {});
      assert.strictEqual(result.items[0], '{{ $json.n1.val }}');
      assert.strictEqual(result.items[1], '静态文本');
      assert.strictEqual(result.items[2], '{{ $json.n2.val }}');
    });

    it('should return non-object inputs unchanged', () => {
      assert.strictEqual(mapper.convertConfig(null, 'coze'), null);
      assert.strictEqual(mapper.convertConfig('string', 'coze'), 'string');
      assert.strictEqual(mapper.convertConfig(42, 'coze'), 42);
    });
  });

  // ==================== getMappingInfo ====================

  describe('getMappingInfo', () => {
    it('should return mapping info for known mappings', () => {
      const info = mapper.getMappingInfo('coze', '1');
      assert.ok(info);
      assert.strictEqual(info.type, 'start');
      assert.strictEqual(info.n8n, 'n8n-nodes-base.webhook');
    });

    it('should return null for unknown sourceFormat', () => {
      assert.strictEqual(mapper.getMappingInfo('nonexistent', '1'), null);
    });

    it('should return null for unknown originalType', () => {
      assert.strictEqual(mapper.getMappingInfo('coze', '9999'), null);
    });
  });
});
