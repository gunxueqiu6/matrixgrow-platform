/**
 * Model Mapping - 模型映射单元测试
 *
 * 测试 AI 提供商和模型的查询逻辑
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { ModelMapping } = require('../utils/model-mapping');

describe('ModelMapping', () => {
  // ==================== getAvailableModels ====================

  describe('getAvailableModels', () => {
    it('should return all LLM models', () => {
      const models = ModelMapping.getAvailableModels('llm');
      assert.ok(models.length > 0);
      assert.ok(models.some(m => m.provider === 'claude'));
      assert.ok(models.some(m => m.provider === 'deepseek'));
      assert.ok(models.some(m => m.provider === 'openai'));
      assert.ok(models.some(m => m.provider === 'qwen'));
    });

    it('should return image generation models', () => {
      const models = ModelMapping.getAvailableModels('image');
      assert.ok(models.length > 0);
      assert.ok(models.some(m => m.provider === 'fal'));
      assert.ok(models.some(m => m.provider === 'replicate'));
    });

    it('should return video generation models', () => {
      const models = ModelMapping.getAvailableModels('video');
      assert.ok(models.length > 0);
      assert.ok(models.some(m => m.provider === 'heygen'));
    });

    it('should return empty array for unknown type', () => {
      const models = ModelMapping.getAvailableModels('unknown');
      assert.deepStrictEqual(models, []);
    });

    it('should include model names in result', () => {
      const models = ModelMapping.getAvailableModels('llm');
      models.forEach(m => {
        assert.ok(m.provider);
        assert.ok(m.model);
        assert.ok(m.name);
      });
    });
  });

  // ==================== getProviderConfig ====================

  describe('getProviderConfig', () => {
    it('should return config for known providers', () => {
      const config = ModelMapping.getProviderConfig('deepseek', 'llm');
      assert.ok(config);
      assert.strictEqual(config.name, 'DeepSeek');
      assert.ok(config.endpoint);
      assert.ok(config.pricing);
      assert.ok(config.models.length > 0);
    });

    it('should return null for unknown provider', () => {
      const config = ModelMapping.getProviderConfig('nonexistent', 'llm');
      assert.strictEqual(config, null);
    });

    it('should return config for image providers', () => {
      const config = ModelMapping.getProviderConfig('fal', 'image');
      assert.ok(config);
      assert.strictEqual(config.name, 'Fal.ai');
    });
  });

  // ==================== getDefaultModel ====================

  describe('getDefaultModel', () => {
    it('should return default model for known provider', () => {
      const model = ModelMapping.getDefaultModel('deepseek', 'llm');
      assert.strictEqual(model, 'deepseek-chat');
    });

    it('should return null for unknown provider', () => {
      const model = ModelMapping.getDefaultModel('nonexistent', 'llm');
      assert.strictEqual(model, null);
    });

    it('should return correct defaults per provider', () => {
      assert.strictEqual(ModelMapping.getDefaultModel('claude', 'llm'), 'claude-sonnet-4-6');
      assert.strictEqual(ModelMapping.getDefaultModel('openai', 'llm'), 'gpt-4o');
      assert.strictEqual(ModelMapping.getDefaultModel('qwen', 'llm'), 'qwen-plus');
    });
  });

  // ==================== hasCapability ====================

  describe('hasCapability', () => {
    it('should return true when provider has capability', () => {
      assert.strictEqual(ModelMapping.hasCapability('claude', 'tool', 'llm'), true);
      assert.strictEqual(ModelMapping.hasCapability('openai', 'image', 'llm'), true);
      assert.strictEqual(ModelMapping.hasCapability('deepseek', 'text', 'llm'), true);
    });

    it('should return false when provider lacks capability', () => {
      assert.strictEqual(ModelMapping.hasCapability('deepseek', 'image', 'llm'), false);
      assert.strictEqual(ModelMapping.hasCapability('qwen', 'tool', 'llm'), false);
    });

    it('should return false for unknown provider', () => {
      assert.strictEqual(ModelMapping.hasCapability('nonexistent', 'text', 'llm'), false);
    });

    it('should work with image providers', () => {
      assert.strictEqual(ModelMapping.hasCapability('fal', 'text-to-image', 'image'), true);
      assert.strictEqual(ModelMapping.hasCapability('fal', 'text-to-video', 'image'), false);
    });
  });

  // ==================== getProviderOptions ====================

  describe('getProviderOptions', () => {
    it('should return all LLM providers as options', () => {
      const options = ModelMapping.getProviderOptions('llm');
      assert.ok(options.length >= 4);
      const claude = options.find(o => o.id === 'claude');
      assert.ok(claude);
      assert.strictEqual(claude.name, 'Anthropic Claude');
      assert.ok(claude.capabilities);
      assert.ok(claude.pricing);
    });

    it('should return empty array for unknown type', () => {
      const options = ModelMapping.getProviderOptions('unknown');
      assert.deepStrictEqual(options, []);
    });
  });

  // ==================== getModelOptions ====================

  describe('getModelOptions', () => {
    it('should return models for a specific provider', () => {
      const models = ModelMapping.getModelOptions('deepseek', 'llm');
      assert.ok(models.length > 0);
      assert.ok(models.some(m => m.id === 'deepseek-chat'));
      assert.ok(models.some(m => m.id === 'deepseek-coder'));
    });

    it('should return empty array for unknown provider', () => {
      const models = ModelMapping.getModelOptions('nonexistent', 'llm');
      assert.deepStrictEqual(models, []);
    });

    it('should include correct model ids', () => {
      const models = ModelMapping.getModelOptions('openai', 'llm');
      assert.ok(models.some(m => m.id === 'gpt-4'));
      assert.ok(models.some(m => m.id === 'gpt-4o'));
    });
  });

  // ==================== Integration ====================

  describe('integration', () => {
    it('should correctly count all models across providers', () => {
      const llmModels = ModelMapping.getAvailableModels('llm');
      const imageModels = ModelMapping.getAvailableModels('image');
      const videoModels = ModelMapping.getAvailableModels('video');

      // Verify total models
      // LLM: claude(4) + deepseek(2) + openai(3) + qwen(3) = 12
      // Image: fal(2) + replicate(1) = 3
      // Video: heygen(1) = 1
      assert.ok(llmModels.length >= 10);
      assert.ok(imageModels.length >= 2);
      assert.ok(videoModels.length >= 1);
    });

    it('every default model should be in the model list', () => {
      const providers = ModelMapping.getProviderOptions('llm');
      providers.forEach(p => {
        const defaultModel = ModelMapping.getDefaultModel(p.id, 'llm');
        const models = ModelMapping.getModelOptions(p.id, 'llm');
        assert.ok(models.some(m => m.id === defaultModel),
          `Default model "${defaultModel}" not in model list for ${p.id}`);
      });
    });

    it('every provider option should have a config', () => {
      const options = ModelMapping.getProviderOptions('llm');
      options.forEach(o => {
        const config = ModelMapping.getProviderConfig(o.id, 'llm');
        assert.ok(config, `Missing config for provider: ${o.id}`);
      });
    });
  });
});
